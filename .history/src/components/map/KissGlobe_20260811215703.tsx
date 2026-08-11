      if (sRes?.address) senderCity = sRes.address.city || sRes.address.town || sRes.address.state || sRes.address.country || senderCity;
      if (rRes?.address) receiverCity = rRes.address.city || rRes.address.town || rRes.address.state || rRes.address.country || receiverCity;
    } catch {}

    // Dove: straight approach line from off-screen west → receiver.
    // Every other vehicle: great-circle arc between sender/receiver.
    const arcPoints = vehicle.kind === 'dove'
      ? interpolateGreatCircle(doveApproachStart, to, 120)
      : interpolateGreatCircle(from, to, vehicle.arcSteps);

    // Remove existing gift marker — will re-place when plane arrives
    const existingGift = markersRef.current.get(kiss.id);
    if (existingGift) { existingGift.remove(); markersRef.current.delete(kiss.id); }

    // Animation element — vehicle SVG chosen by distance.
    // maplibre applies its OWN positioning transform to planeEl, so we
    // put motion offsets / altitude scale on an INNER wrapper. Otherwise
    // our transform would fight maplibre's and either be overwritten
    // (silent no-op) or throw the marker off-screen.
    const planeEl = document.createElement('div');
    planeEl.style.cssText = `pointer-events:none;width:${vehicle.size}px;height:${vehicle.size}px;`;
    const innerEl = document.createElement('div');
    innerEl.style.cssText = `width:100%;height:100%;`;
    innerEl.innerHTML = buildVehicleSvg(vehicle.kind, kiss.id);
    planeEl.appendChild(innerEl);
    // rotation=0 means pointing up (North). setRotation(bearing) points it in travel direction.
    const planeMarker = new maplibregl.Marker({ element: planeEl, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat(arcPoints[0])
      .addTo(map);
    markersRef.current.set(`plane_${kiss.id}`, planeMarker);

    // ── Draw flight path ──
    // Dove: SOLID thick pink line with WHITE casing underneath so the
    //       route is unmistakable on satellite tiles (green/brown/blue).
    // Others: dashed line as before.
    // Layers are only added once the map's style is fully loaded —
    // otherwise addSource/addLayer can silently fail on cold-start.
    const lineId = `kiss-arc-${kiss.id}`;
    const casingId = `kiss-arc-cas-${kiss.id}`;
    const addArcLayers = () => {
      if (!map.getSource(lineId)) {
        map.addSource(lineId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arcPoints }, properties: {} } });
      }
      if (!map.getLayer(lineId)) {
        const arcPaint: Record<string, unknown> = {
          'line-color': vehicle.lineColor,
          'line-width': vehicle.lineWidth,
          'line-opacity': 0.7,
        };
        if (vehicle.lineDash) arcPaint['line-dasharray'] = vehicle.lineDash;
        map.addLayer({ id: lineId, type: 'line', source: lineId, paint: arcPaint });
      }
    };
    if (map.isStyleLoaded()) addArcLayers();
    else map.once('idle', addArcLayers);

    // Dove has its own overlay flow (returned early above). Below only
    // runs for motorbike / car / plane. `doveEndpointKeys` is kept as an
    // empty array so shared cleanup code compiles unchanged.
    const doveEndpointKeys: string[] = [];

    // Trail line (shows where the vehicle has been — solid, vehicle-coloured).
    const trailId = `kiss-trail-${kiss.id}`;
    const trailCoords: [number, number][] = [];
    const addTrailLayers = () => {
      if (!map.getSource(trailId)) {
        map.addSource(trailId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
        map.addLayer({ id: trailId, type: 'line', source: trailId,
          paint: { 'line-color': vehicle.lineColor, 'line-width': 2.5, 'line-opacity': 0.9 },
          layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
    };
    if (map.isStyleLoaded()) addTrailLayers();
    else map.once('idle', addTrailLayers);

    const isFollowing = () => activeFollowRef.current === kiss.id;

    // ── Buttery smooth flight — direct camera control each frame ──
    const flightMs = vehicle.durationMs;
    let t0 = 0;
    // Camera state — lerped every frame for zero jitter
    let camLng = from[0], camLat = from[1], camZoom = 9, camPitch = 0, camBearing = 0;
    let planeLng = arcPoints[0][0], planeLat = arcPoints[0][1], planeBrg = 0;

    // Turbulence zones — only for airliners; other vehicles use their own
    // signature motion (dove flutter, balloon sway, rocket ramrod) below.
    const turbZones = vehicle.kind === 'plane' ? Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => {
      const center = 0.15 + Math.random() * 0.6;
      const width = 0.03 + Math.random() * 0.04;
      return { start: center - width, end: center + width };
    }) : [];
    let turbulenceActive = false;

    function fly(ts: number) {
      if (!t0) t0 = ts;
      const elapsed = ts - t0;
      // Ease-in-out-cubic for natural motion
      const lin = Math.min(elapsed / flightMs, 1);
      const t = lin < 0.5 ? 4 * lin * lin * lin : 1 - Math.pow(-2 * lin + 2, 3) / 2;

      if (t >= 1) {
        // Arrived — full cleanup
        planeMarker.remove();
        planeEl.remove();
        markersRef.current.delete(`plane_${kiss.id}`);
        animFrameRef.current.delete(kiss.id);
        // Remove dove endpoint pulse markers (start + end pink dots)
        doveEndpointKeys.forEach(k => {
          const m = markersRef.current.get(k);
          if (m) { m.remove(); markersRef.current.delete(k); }
        });
        placeGiftMarker(kiss);

        // Stop camera control + reset to normal view. Dove keeps the
        // route-framed view so the finished route stays visible.
        setFlightHUD(null);
        activeFollowRef.current = null;
        // Dove keeps its 3D pitch on arrival (no flatten to 2D); other
        // vehicles level out to 0° at their final landing.
        const arrivalPitch = vehicle.kind === 'dove' ? 45 : 0;
        map?.jumpTo({ center: to, zoom: isGlobe ? 4 : vehicle.landZoom, pitch: arrivalPitch, bearing: 0 });

        // Clean arc/trail lines (and dove casing) after delay
        setTimeout(() => {
          [casingId, trailId, lineId].forEach(lid => {
            try { if (map?.getLayer(lid)) map.removeLayer(lid); } catch {}
          });
          [trailId, lineId].forEach(sid => {
            try { if (map?.getSource(sid)) map.removeSource(sid); } catch {}
          });
        }, 3000);
        return;
      }

      // ── Plane position: smooth sub-pixel interpolation ──
      const exactIdx = t * (arcPoints.length - 1);
      const i = Math.floor(exactIdx);
      const f = exactIdx - i;
      const a = arcPoints[i];
      const b = arcPoints[Math.min(i + 1, arcPoints.length - 1)];
      const tgtLng = a[0] + (b[0] - a[0]) * f;
      const tgtLat = a[1] + (b[1] - a[1]) * f;

      // Lerp plane position — handle dateline wrapping
      let dLng = tgtLng - planeLng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      planeLng += dLng * 0.12;
      planeLat += (tgtLat - planeLat) * 0.12;

      // ── Per-vehicle motion signature ──
      //  dove      : constant fluttery Y/X sine + slow altitude illusion
      //              (scale + drop-shadow modulated by a sine so the bird
      //              visibly rises and dips across the map)
      //  motorbike : subtle high-freq wobble (bumps in the road)
      //  car       : very slight sway (smooth suspension)
      //  plane     : airliner turbulence bob only during weather zones
      let motionOffsetY = 0;
      let motionOffsetX = 0;
      const extraTransform = '';
      const extraFilter = '';
      turbulenceActive = false;
      if (vehicle.kind === 'plane') {
        turbulenceActive = turbZones.some(z => t >= z.start && t <= z.end);
        if (turbulenceActive) {
          motionOffsetY = Math.sin(elapsed * 0.008) * 6 + Math.sin(elapsed * 0.013) * 3;
        }
      } else if (vehicle.kind === 'motorbike') {
        motionOffsetY = Math.sin(elapsed * 0.03) * 1.2;
        motionOffsetX = Math.sin(elapsed * 0.026) * 0.8;
      } else if (vehicle.kind === 'car') {
        motionOffsetX = Math.sin(elapsed * 0.004) * 1;
      }
      innerEl.style.transform = (motionOffsetX || motionOffsetY || extraTransform)
        ? `translate(${motionOffsetX}px, ${motionOffsetY}px)${extraTransform}`
        : '';
      innerEl.style.filter = extraFilter;

      planeMarker.setLngLat([planeLng, planeLat]);

      // ── Vehicle bearing: look far ahead + heavy smoothing ──
      // Ground vehicles (motorbike/car) get slightly tighter smoothing than the plane
      // so they don't lag when the arc curves.
      const lookIdx = Math.min(i + Math.max(15, Math.floor(arcPoints.length * 0.03)), arcPoints.length - 1);
      const lk = arcPoints[lookIdx];
      const dLn = (lk[0] - planeLng) * Math.PI / 180;
      const la1 = planeLat * Math.PI / 180;
      const la2 = lk[1] * Math.PI / 180;
      const rawBrg = Math.atan2(Math.sin(dLn) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLn)) * 180 / Math.PI;
      let brgDiff = rawBrg - planeBrg;
      if (brgDiff > 180) brgDiff -= 360;
      if (brgDiff < -180) brgDiff += 360;
      const brgSmooth = (vehicle.kind === 'motorbike' || vehicle.kind === 'car') ? 0.05 : 0.03;
      planeBrg += brgDiff * brgSmooth;
      // Dove: skip setRotation — the emoji is scaleX(-1) flipped to face
      // right (east). Rotating the marker would spin the emoji off-axis.
      if (vehicle.kind !== 'dove') planeMarker.setRotation(planeBrg);

      // ── Dove: LANDING approach. Camera fixed on RECEIVER (not follow
      // bird). Zoom eases 11 → 15 (approach → close). PITCH STAYS AT 45°
      // for the whole flight so the map keeps its 3D perspective — never
      // flattens to 2D. The bird visibly lands on the receiver's address
      // against the tilted city view.
      if (isFollowing() && vehicle.kind === 'dove') {
        const approachZoom = 11;
        const landingZoom = 15;
        const cruisePitch = 45;
        const tgtZoom = approachZoom + (landingZoom - approachZoom) * t;
        camLng += (to[0] - camLng) * 0.08;
        camLat += (to[1] - camLat) * 0.08;
        camZoom += (tgtZoom - camZoom) * 0.08;
        camPitch += (cruisePitch - camPitch) * 0.08;
        map?.jumpTo({ center: [camLng, camLat], zoom: camZoom, pitch: camPitch, bearing: 0 });
        setFlightHUD({
          from: senderCity, to: receiverCity, progress: t,
          senderName: kiss.sender_name || 'Sender',
          receiverName: currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Receiver'),
          emoji: vehicle.emoji,
          turbulence: false,
        });
      }
      // ── Camera: lerp ALL properties every frame → zero jitter ──
      // Motorbike / car / plane use the cinematic follow camera so the trip
      // feels like a full journey with the vehicle in view the whole time.
      else if (isFollowing()) {
        let tgtZoom: number, tgtPitch: number;

        if (isGlobe) {
          // Globe: zoom out to see Earth, then zoom in for landing.
          const orbitZ = 1.8;
          const landZ = vehicle.landZoom;
          if (t < 0.1) { tgtZoom = 5 - (5 - orbitZ) * (t / 0.1); tgtPitch = 0; }
          else if (t > 0.9) { tgtZoom = orbitZ + (landZ - orbitZ) * ((t - 0.9) / 0.1); tgtPitch = ((t - 0.9) / 0.1) * 40; }
          else { tgtZoom = orbitZ; tgtPitch = 0; }
        } else {
          const cruiseZ = vehicle.cruiseZoom;
          const cruisePitch = vehicle.cruisePitch;
          const landZ = vehicle.landZoom;
          if (t < 0.12) { tgtZoom = openZoom - (openZoom - cruiseZ) * (t / 0.12); tgtPitch = t / 0.12 * cruisePitch; }
          else if (t > 0.85) { tgtZoom = cruiseZ + (landZ - cruiseZ) * ((t - 0.85) / 0.15); tgtPitch = ((1 - t) / 0.15) * cruisePitch; }
          else { tgtZoom = cruiseZ; tgtPitch = cruisePitch; }
        }

        // Camera looks ahead of the vehicle.
        const lookAmt = isGlobe ? 40 : 25;
        const camLookIdx = Math.min(i + lookAmt, arcPoints.length - 1);
        const cl = arcPoints[camLookIdx];

        const lerpSpeed = isGlobe ? 0.025 : 0.04;
        let camDLng = cl[0] - camLng;
        if (camDLng > 180) camDLng -= 360;
        if (camDLng < -180) camDLng += 360;
        camLng += camDLng * lerpSpeed;
        camLat += (cl[1] - camLat) * lerpSpeed;
        camZoom += (tgtZoom - camZoom) * lerpSpeed;
        camPitch += (tgtPitch - camPitch) * lerpSpeed;
        let camBrgDiff = planeBrg - camBearing;
        if (camBrgDiff > 180) camBrgDiff -= 360;
        if (camBrgDiff < -180) camBrgDiff += 360;
        camBearing += camBrgDiff * (isGlobe ? 0.02 : 0.03);

        map?.jumpTo({ center: [camLng, camLat], zoom: camZoom, pitch: camPitch, bearing: isGlobe ? 0 : camBearing });

        setFlightHUD({
          from: senderCity, to: receiverCity, progress: t,
          senderName: kiss.sender_name || 'Sender',
          receiverName: currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Receiver'),
          emoji: vehicle.emoji,
          turbulence: turbulenceActive,
        });
      }

      // Trail
      if (i % 10 === 0) {
        trailCoords.push([planeLng, planeLat]);
        try {
          const src = map?.getSource(trailId) as maplibregl.GeoJSONSource;
          if (src) src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: trailCoords }, properties: {} });
        } catch {}
      }

      const frame = requestAnimationFrame(fly);
      animFrameRef.current.set(kiss.id, frame);
    }

    // Start — three opening moves matched to vehicle behaviour:
    //  • dove   → fly to RECEIVER at approach zoom (11) with pitch 45°
    //             so the show opens like a plane cockpit on final approach.
    //             Fly loop then lerps camera to landing zoom + level pitch
    //             while the bird flies in from off-screen and lands.
    //  • globe  → fly to sender then pull out to see Earth
    //  • other  → swoop into the journey at cruise pitch
    if (vehicle.kind === 'dove') {
      map?.flyTo({
        center: to,
        zoom: 11,
        pitch: 45,
        bearing: 0,
        duration: 1200,
        easing: (x: number) => 1 - Math.pow(1 - x, 3),
      });
      // Seed camera state so fly-loop lerp starts from this landed pose
      camLng = to[0]; camLat = to[1]; camZoom = 11; camPitch = 45; camBearing = 0;
      setTimeout(() => requestAnimationFrame(fly), 1400);
    } else if (isGlobe) {
      map?.flyTo({ center: from, zoom: openZoom, pitch: 0, bearing: 0, duration: 2000 });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = openZoom; camPitch = 0; camBearing = 0;
        requestAnimationFrame(fly);
      }, 2300);
    } else {
      map?.flyTo({ center: from, zoom: openZoom, pitch: vehicle.cruisePitch, bearing: 0, duration: 2500, easing: (x: number) => 1 - Math.pow(1 - x, 3) });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = openZoom; camPitch = vehicle.cruisePitch; camBearing = 0;
        requestAnimationFrame(fly);
      }, 2800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mutate, currentUserId, placeGiftMarker]);

  // Place/remove gift markers based on layer toggle
  // On 3D globe: don't auto-place markers (only show on ?kiss= replay)
  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';
    if (giftLayerOn && !isGlobe) {
      kisses.forEach(k => {
        if (markersRef.current.has(`plane_${k.id}`)) return;
        placeGiftMarker(k);
      });
    } else if (!giftLayerOn) {
      // Clean everything: markers, animations, map layers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
      animFrameRef.current.clear();
      activeFollowRef.current = null;
      setFlightHUD(null);
      // Remove all kiss arc/trail layers
      kisses.forEach(k => {
        ['kiss-arc-', 'kiss-trail-'].forEach(prefix => {
          try { if (map.getLayer(`${prefix}${k.id}`)) map.removeLayer(`${prefix}${k.id}`); } catch {}
          try { if (map.getSource(`${prefix}${k.id}`)) map.removeSource(`${prefix}${k.id}`); } catch {}
        });
      });
    }
  }, [map, kisses, placeGiftMarker, giftLayerOn]);

  // Hide/show gift markers based on zoom level (prevent clutter on globe)
  useEffect(() => {
    if (!map || !giftLayerOn) return;
    const updateVisibility = () => {
      const zoom = map.getZoom();
      const isGlobe = useMapStore.getState().viewMode === '3d';
      const minZoom = isGlobe ? 4 : 0; // hide on globe when zoomed out
      markersRef.current.forEach((marker, key) => {
        if (key.startsWith('plane_')) return; // don't hide flying planes
        marker.getElement().style.display = zoom >= minZoom ? '' : 'none';
      });
    };
    map.on('zoom', updateVisibility);
    updateVisibility();
    return () => { map.off('zoom', updateVisibility); };
  }, [map, giftLayerOn]);

  // Listen for ?kiss=<id> URL param — replay that kiss animation
  useEffect(() => {
    if (!map || kisses.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const kissId = params.get('kiss');
    if (!kissId || replayedRef.current.has(kissId)) return;

    const kiss = kisses.find(k => k.id === kissId);
    if (kiss) {
      replayedRef.current.add(kissId);
      // Clean URL
      window.history.replaceState(null, '', '/world');
      // Small delay to let map settle, then replay
      setTimeout(() => playFlightAnimation(kiss), 1000);
    }
  }, [map, kisses, playFlightAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
    };
  }, []);

  return (
    <>
      {/* Flight HUD overlay */}
      <AnimatePresence>
        {flightHUD && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <FlightHUD {...flightHUD} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Modal — full-screen fallback opened by KissRevealPopup's
          Send-Back flow via useGiftsPopupStore.openKissModalDirect().
          (The Gifts chip on the top filter bar uses the tabbed
          GiftsPopup below, which embeds this same SendKissModal
          inline in its Kiss tab.) */}
      <AnimatePresence>
        {showSendModal && <SendKissModal defaultReceiverId={sendBackTo} onClose={closeKissModal} onSent={async () => {
          const fresh = await mutate();
          const newest = (fresh as { data: Kiss[] } | undefined)?.data?.[0];
          if (newest) setTimeout(() => playFlightAnimation(newest), 500);
        }} />}
      </AnimatePresence>

      {/* Kiss Reveal */}
      <AnimatePresence>
        {revealKiss && <KissRevealPopup kiss={revealKiss} onClose={() => setRevealKiss(null)} currentUserId={currentUserId} onSendBack={(toId) => useGiftsPopupStore.getState().openKissModalDirect(toId)} />}
      </AnimatePresence>

      {/* Unified Gifts popup (tabbed: Kiss + Templates) — opened by
          the Gifts chip in LayerFilterPanel. */}
      <GiftsPopup />

      {/* Template builders — full-screen modals opened when the user
          picks a template card inside GiftsPopup's Templates tab. */}
      <HeartBuilder open={isHeartBuilderOpen} onClose={closeHeartBuilder} />
      <CoupleCardBuilder open={isCoupleBuilderOpen} onClose={closeCoupleBuilder} />
      {/* Birthday launches the time-capsule composer preloaded with
          the birthday theme. Recipients get the cinematic drone
          reveal via BirthdayJourneyFlow when they open the capsule. */}
      <CapsuleCreateModal
        open={isBirthdayCapsuleOpen}
        onClose={closeBirthdayCapsule}
        initialThemeId="birthday"
      />

      {/* Auth Gate */}
      <SignInGateSheet action="default" isOpen={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </>
  );
}

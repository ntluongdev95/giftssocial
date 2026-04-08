'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem('gao_splash_shown'));
  const [fadeOut, setFadeOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js Earth + Stars
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = window.innerWidth < 768 ? 3.8 : 2.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 3000;
    const positions = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);
    for (let i = 0; i < starsCount; i++) {
      const r = 50 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Earth
    const loader = new THREE.TextureLoader();
    const earthTexture = loader.load('/images/earth-texture.jpg');
    const bumpTexture = loader.load('/images/earth-bump.png');
    const specTexture = loader.load('/images/earth-specular.png');

    earthTexture.colorSpace = THREE.SRGBColorSpace;

    const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.03,
      specularMap: specTexture,
      specular: new THREE.Color(0x333333),
      shininess: 15,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.rotation.z = -0.15; // Slight tilt
    scene.add(earth);

    // Atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(1.015, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;
          gl_FragColor = vec4(atmosphere, intensity * 0.6);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Outer glow
    const glowGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const glowMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          vec3 glow = vec3(0.1, 0.4, 1.0) * intensity;
          gl_FragColor = vec4(glow, intensity * 0.15);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // Lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 2);
    sunLight.position.set(-3, 1, 3);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x222244, 0.5);
    scene.add(ambientLight);

    // Animate
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      earth.rotation.y += 0.002;
      atmosphere.rotation.y += 0.002;
      stars.rotation.y += 0.0001;
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = window.innerWidth < 768 ? 3.8 : 2.8;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Splash timing
  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem('gao_splash_shown', 'true');

    const t1 = setTimeout(() => setFadeOut(true), 3000);
    const t2 = setTimeout(() => setVisible(false), 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-500"
      style={{ zIndex: 9999, opacity: fadeOut ? 0 : 1, background: '#000' }}
    >
      {/* Three.js canvas container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Logo + text overlay */}
      <div className="absolute bottom-[15%] flex flex-col items-center">
        <div className="animate-[scaleIn_0.8s_ease-out]" style={{ filter: 'drop-shadow(0 0 30px rgba(0,212,255,0.4))' }}>
          <img src="/images/gao-logo.png" alt="Gao" width={80} height={80} />
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-[0.25em] text-white animate-[fadeUp_0.6s_ease-out_0.4s_both]">
          GAO SOCIAL
        </h1>

        <p className="mt-1.5 text-[10px] tracking-[0.3em] animate-[fadeUp_0.6s_ease-out_0.6s_both]" style={{ color: '#4a6080' }}>
          MAP · SIGNALS · ACTION
        </p>

        <div
          className="mt-6 h-[2px] w-28 overflow-hidden rounded-full animate-[fadeUp_0.6s_ease-out_0.8s_both]"
          style={{ background: 'rgba(0,212,255,0.08)' }}
        >
          <div
            className="h-full rounded-full animate-[loadBar_2.5s_ease-in-out_0.5s_both]"
            style={{
              background: 'linear-gradient(90deg, #00d4ff, #6366f1, #00d4ff)',
              boxShadow: '0 0 10px rgba(0,212,255,0.6)',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.05); }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeUp {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes loadBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

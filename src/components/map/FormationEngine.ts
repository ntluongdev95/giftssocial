export interface FormationPoint {
  x: number;
  y: number;
  rotation: number;
}

export function createTextFormation(
  text: string,
  width: number,
  height: number,
  density = 8
): FormationPoint[] {
  const points: FormationPoint[] = [];

  /*
   * Tạm thời tạo grid.
   *
   * Bước tiếp theo sẽ dùng Canvas để:
   *
   * "ARE YOU READY TO..."
   *
   * thành pixel points thật.
   */

  const cols = Math.max(1, Math.floor(width / density));
  const rows = Math.max(1, Math.floor(height / density));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      points.push({
        x: col * density,
        y: row * density,
        rotation: 0,
      });
    }
  }

  return points;
}
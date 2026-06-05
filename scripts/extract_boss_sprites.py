#!/usr/bin/env python3
from pathlib import Path
from typing import Dict, List, Optional
from PIL import Image


def extract_sprite_sheet(
    image_path: Path,
    total_rows: int,
    total_cols: int,
    output_dir: Optional[Path] = None,
    save_manifest: bool = False,
) -> List[Dict[str, object]]:
    """Slice a sprite sheet into a strict grid of cells.

    Args:
        image_path: Path to the sprite sheet image.
        total_rows: Number of rows in the sprite grid.
        total_cols: Number of columns in the sprite grid.
        output_dir: Directory to write cropped sprites to. Defaults to image folder.
        save_manifest: If True, writes a JSON manifest with names and centers.

    Returns:
        A list of metadata dictionaries for each extracted cell.
    """
    if total_rows <= 0 or total_cols <= 0:
        raise ValueError('total_rows and total_cols must be positive integers')

    if output_dir is None:
        output_dir = image_path.resolve().parent / f"{image_path.stem}_cells"
    output_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(image_path) as sheet:
        width, height = sheet.size
        horizontal_step = width / total_cols
        vertical_step = height / total_rows

        print(f"Source image: {image_path}")
        print(f"Image dimensions: {width} x {height}")
        print(f"Grid: {total_rows} rows x {total_cols} cols")
        print(f"Cell size: {horizontal_step} x {vertical_step}")

        manifest: List[Dict[str, object]] = []

        for row in range(total_rows):
            for col in range(total_cols):
                x_start = int(col * horizontal_step)
                y_start = int(row * vertical_step)
                x_end = int((col + 1) * horizontal_step)
                y_end = int((row + 1) * vertical_step)

                cell = sheet.crop((x_start, y_start, x_end, y_end))
                file_name = f"{image_path.stem}_{row}_{col}.png"
                output_path = output_dir / file_name
                cell.save(output_path)

                center_x = x_start + (horizontal_step / 2)
                center_y = y_start + (vertical_step / 2)

                manifest.append({
                    'file_name': file_name,
                    'row': row,
                    'col': col,
                    'x_start': x_start,
                    'y_start': y_start,
                    'x_end': x_end,
                    'y_end': y_end,
                    'center_x': center_x,
                    'center_y': center_y,
                })

                print(
                    f"Saved {file_name}: "
                    f"box=({x_start},{y_start},{x_end},{y_end}) "
                    f"center=({center_x:.1f},{center_y:.1f})"
                )

    if save_manifest:
        import json

        manifest_path = output_dir / f"{image_path.stem}_manifest.json"
        with manifest_path.open('w', encoding='utf-8') as manifest_file:
            json.dump(manifest, manifest_file, indent=2)
        print(f"Manifest written to: {manifest_path}")

    print(f"Extraction complete. Files written to: {output_dir}")
    return manifest


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Extract a sprite sheet into a strict grid of cell images.')
    parser.add_argument('image_path', help='Path to the sprite sheet image.')
    parser.add_argument('rows', type=int, help='Number of rows in the sprite sheet grid.')
    parser.add_argument('cols', type=int, help='Number of columns in the sprite sheet grid.')
    parser.add_argument('--output-dir', help='Directory to save extracted sprites.')
    parser.add_argument('--manifest', action='store_true', help='Write a JSON manifest with center coordinates.')

    args = parser.parse_args()

    image_path = Path(args.image_path)
    if not image_path.exists():
        raise FileNotFoundError(f"Sprite sheet not found: {image_path}")

    extract_sprite_sheet(
        image_path=image_path,
        total_rows=args.rows,
        total_cols=args.cols,
        output_dir=Path(args.output_dir) if args.output_dir else None,
        save_manifest=args.manifest,
    )

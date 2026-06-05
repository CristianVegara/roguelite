#!/usr/bin/env python3
"""Extracts a uniform minion sprite sheet into individual engine-ready cells.

This script uses exact coordinates and spacing from GIMP to prevent drift,
out-of-bounds compression, and manifest mismatches.
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List
from PIL import Image

# -------------------------
# SPRITE SHEET CONFIGURATION
# -------------------------
IMAGE_PATH = Path('src/assets/sprites/monster_sheet_1.png')
OUTPUT_SUBDIR = 'monster_sheet_1_cells'
FILE_PREFIX = 'monster_1'
TOTAL_ROWS = 5
TOTAL_COLS = 8
CELL_WIDTH = 168
CELL_HEIGHT = 144
START_X = 0
START_Y = 38
STRIDE_X = 168
STRIDE_Y = 144
# -------------------------


def build_output_dir(image_path: Path) -> Path:
    return image_path.resolve().parent / OUTPUT_SUBDIR


def build_manifest_entry(
    file_name: str,
    row_index: int,
    col_index: int,
    x_pos: int,
    y_pos: int,
    width: int,
    height: int,
    center_x: float,
    center_y: float,
) -> Dict[str, object]:
    return {
        'file_name': file_name,
        'row': row_index,
        'col': col_index,
        'top_left': [x_pos, y_pos],
        'bounding_box': [x_pos, y_pos, x_pos + width, y_pos + height],
        'center': [center_x, center_y],
        'width': width,
        'height': height,
    }


def extract_sprite_sheet(image_path: Path, clamp: bool, manifest: bool) -> List[Dict[str, object]]:
    image_path = image_path.resolve()
    if not image_path.exists():
        raise FileNotFoundError(f'Sprite sheet not found: {image_path}')

    output_dir = build_output_dir(image_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries: List[Dict[str, object]] = []

    with Image.open(image_path) as sheet:
        sheet_width, sheet_height = sheet.size

        print(f'Source image: {image_path}')
        print(f'Sheet size: {sheet_width} x {sheet_height}')
        print(f'Grid: {TOTAL_ROWS} rows x {TOTAL_COLS} cols')
        print(f'Cell size: {CELL_WIDTH} x {CELL_HEIGHT}')
        print(f'Start X: {START_X} | Stride X: {STRIDE_X}')
        print(f'Start Y: {START_Y} | Stride Y: {STRIDE_Y}')
        print(f'Output directory: {output_dir}')
        print(f'Clamp mode: {clamp}')

        for row_index in range(TOTAL_ROWS):
            y_pos = START_Y + (row_index * STRIDE_Y)
            for col_index in range(TOTAL_COLS):
                x_pos = START_X + (col_index * STRIDE_X)
                x_end = x_pos + CELL_WIDTH
                y_end = y_pos + CELL_HEIGHT

                if x_pos < 0 or y_pos < 0:
                    raise ValueError(
                        f'Invalid negative origin for row={row_index}, col={col_index}: '
                        f'({x_pos},{y_pos})'
                    )

                if x_end > sheet_width or y_end > sheet_height:
                    if clamp:
                        x_end = min(x_end, sheet_width)
                        y_end = min(y_end, sheet_height)
                        print(
                            f'Clamped out-of-bounds crop for row={row_index}, col={col_index}: '
                            f'({x_pos},{y_pos},{x_end},{y_end})'
                        )
                    else:
                        raise ValueError(
                            f'Crop out of bounds for row={row_index}, col={col_index}: '
                            f'({x_pos},{y_pos},{x_end},{y_end}) vs sheet {sheet_width}x{sheet_height}'
                        )

                cropped = sheet.crop((x_pos, y_pos, x_end, y_end))
                if cropped.size != (CELL_WIDTH, CELL_HEIGHT):
                    if clamp:
                        background_mode = 'RGBA' if sheet.mode == 'RGBA' else sheet.mode
                        background_color = (0, 0, 0, 0) if background_mode == 'RGBA' else 0
                        padded = Image.new(background_mode, (CELL_WIDTH, CELL_HEIGHT), background_color)
                        padded.paste(cropped, (0, 0))
                        cropped = padded
                    else:
                        raise ValueError(
                            f'Unexpected cropped size {cropped.size} for row={row_index}, col={col_index}'
                        )

                file_name = f'{FILE_PREFIX}_{row_index}_{col_index}.png'
                cropped.save(output_dir / file_name)

                center_x = x_pos + (CELL_WIDTH / 2.0)
                center_y = y_pos + (CELL_HEIGHT / 2.0)
                entry = build_manifest_entry(
                    file_name=file_name,
                    row_index=row_index,
                    col_index=col_index,
                    x_pos=x_pos,
                    y_pos=y_pos,
                    width=CELL_WIDTH,
                    height=CELL_HEIGHT,
                    center_x=center_x,
                    center_y=center_y,
                )
                manifest_entries.append(entry)

                print(
                    f'Saved {file_name} | '
                    f'top_left=({x_pos},{y_pos}) | '
                    f'center=({center_x:.2f},{center_y:.2f}) | '
                    f'size=({CELL_WIDTH}x{CELL_HEIGHT})'
                )

    if manifest:
        manifest_path = output_dir / f'{FILE_PREFIX}_manifest.json'
        with manifest_path.open('w', encoding='utf-8') as handle:
            json.dump(manifest_entries, handle, indent=2)
        print(f'Manifest written to: {manifest_path}')

    print(f'Extraction complete. Files written to: {output_dir}')
    return manifest_entries


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Extract monster_sheet_1 into engine-ready cells with exact coordinates.'
    )
    parser.add_argument('--clamp', action='store_true', help='Clamp crops to the sheet boundary if they exceed the image.')
    parser.add_argument('--manifest', action='store_true', help='Write a JSON manifest mapping filename, row, col, bounding boxes, and centers.')
    args = parser.parse_args()

    extract_sprite_sheet(
        image_path=IMAGE_PATH,
        clamp=args.clamp,
        manifest=args.manifest,
    )

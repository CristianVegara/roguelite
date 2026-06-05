#!/usr/bin/env python3
"""Engine-compatible sprite sheet extractor using Pillow.

This utility uses explicit axis lookups for both rows and columns to prevent
pixel drift and ensure every crop matches the engine's exact grid map.
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List
from PIL import Image

# -------------------------
# CONFIGURATION CONSTANTS
# -------------------------
IMAGE_PATH = Path('src/assets/sprites/boss_sheet.png')
TOTAL_ROWS = 5
TOTAL_COLS = 6
SPRITE_W = 202
SPRITE_H = 154
COL_START_X_POSITIONS = [0, 250, 475, 700, 950, 1179]
ROW_START_Y_POSITIONS = [2, 154, 306, 458, 610]
OUTPUT_SUBDIR = 'boss_sheet_cells'
FILE_PREFIX = 'boss_sheet'
# -------------------------


def build_output_dir(image_path: Path) -> Path:
    return image_path.resolve().parent / OUTPUT_SUBDIR


def get_x_position(col_index: int) -> int:
    try:
        return COL_START_X_POSITIONS[col_index]
    except IndexError as exc:
        raise IndexError(
            f'Column index {col_index} is out of range for COL_START_X_POSITIONS'
        ) from exc


def get_y_position(row_index: int) -> int:
    try:
        return ROW_START_Y_POSITIONS[row_index]
    except IndexError as exc:
        raise IndexError(
            f'Row index {row_index} is out of range for ROW_START_Y_POSITIONS'
        ) from exc


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


def extract_sprite_sheet(
    image_path: Path,
    clamp: bool,
    manifest: bool,
) -> List[Dict[str, object]]:
    image_path = image_path.resolve()
    if not image_path.exists():
        raise FileNotFoundError(f'Sprite sheet not found: {image_path}')

    if len(COL_START_X_POSITIONS) != TOTAL_COLS:
        raise ValueError('COL_START_X_POSITIONS length must equal TOTAL_COLS')
    if len(ROW_START_Y_POSITIONS) != TOTAL_ROWS:
        raise ValueError('ROW_START_Y_POSITIONS length must equal TOTAL_ROWS')

    output_dir = build_output_dir(image_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries: List[Dict[str, object]] = []

    with Image.open(image_path) as sheet:
        sheet_width, sheet_height = sheet.size

        print(f'Source image: {image_path}')
        print(f'Sheet size: {sheet_width} x {sheet_height}')
        print(f'Grid: {TOTAL_ROWS} rows x {TOTAL_COLS} cols')
        print(f'Sprite size: {SPRITE_W} x {SPRITE_H}')
        print(f'Column X positions: {COL_START_X_POSITIONS}')
        print(f'Row Y positions: {ROW_START_Y_POSITIONS}')
        print(f'Output directory: {output_dir}')
        print(f'Clamp mode: {clamp}')

        for row_index in range(TOTAL_ROWS):
            y_pos = get_y_position(row_index)
            for col_index in range(TOTAL_COLS):
                x_pos = get_x_position(col_index)
                x_end = x_pos + SPRITE_W
                y_end = y_pos + SPRITE_H

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
                if cropped.size != (SPRITE_W, SPRITE_H):
                    if clamp:
                        background_mode = 'RGBA' if sheet.mode == 'RGBA' else sheet.mode
                        background_color = (0, 0, 0, 0) if background_mode == 'RGBA' else 0
                        padded = Image.new(background_mode, (SPRITE_W, SPRITE_H), background_color)
                        padded.paste(cropped, (0, 0))
                        cropped = padded
                    else:
                        raise ValueError(
                            f'Unexpected cropped size {cropped.size} for row={row_index}, col={col_index}'
                        )

                file_name = f'{FILE_PREFIX}_{row_index}_{col_index}.png'
                cropped.save(output_dir / file_name)

                center_x = x_pos + (SPRITE_W / 2.0)
                center_y = y_pos + (SPRITE_H / 2.0)
                entry = build_manifest_entry(
                    file_name=file_name,
                    row_index=row_index,
                    col_index=col_index,
                    x_pos=x_pos,
                    y_pos=y_pos,
                    width=SPRITE_W,
                    height=SPRITE_H,
                    center_x=center_x,
                    center_y=center_y,
                )
                manifest_entries.append(entry)

                print(
                    f'Saved {file_name} | '
                    f'top_left=({x_pos},{y_pos}) | '
                    f'center=({center_x:.2f},{center_y:.2f}) | '
                    f'size=({SPRITE_W}x{SPRITE_H})'
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
        description='Extract individual assets from a sprite sheet using explicit row/column lookups.'
    )
    parser.add_argument('--clamp', action='store_true', help='Clamp crops to the image boundary if they exceed the sheet.')
    parser.add_argument('--manifest', action='store_true', help='Write a JSON manifest mapping file details and centers.')
    args = parser.parse_args()

    extract_sprite_sheet(
        image_path=IMAGE_PATH,
        clamp=args.clamp,
        manifest=args.manifest,
    )

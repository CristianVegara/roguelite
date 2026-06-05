#!/usr/bin/env python3
"""Extract individual monster cells from monster_sheet_1/2/3 and write a manifest.

This script slices each sheet using exact coordinates and spacing to guarantee
stable engine frames and float center points.
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List, Optional
from PIL import Image

TOTAL_ROWS = 9
TOTAL_COLS = 10
CELL_WIDTH = 125
CELL_HEIGHT = 89
START_X = 0
START_Y = 0
STRIDE_X = 125
STRIDE_Y = 89


def sheet_image_path(sheet_index: int) -> Path:
    return Path(f'src/assets/sprites/monster_sheet_{sheet_index}.png')


def output_dir_for_sheet(sheet_index: int) -> Path:
    return Path(f'src/assets/sprites/monster_sheet_{sheet_index}_cells')


def build_manifest_entry(
    file_name: str,
    row: int,
    col: int,
    x_pos: int,
    y_pos: int,
    width: int,
    height: int,
    center_x: float,
    center_y: float,
) -> Dict[str, object]:
    return {
        'file_name': file_name,
        'row': row,
        'col': col,
        'top_left': [x_pos, y_pos],
        'bounding_box': [x_pos, y_pos, x_pos + width, y_pos + height],
        'center': [center_x, center_y],
        'width': width,
        'height': height,
    }


def extract_sheet(sheet_index: int, clamp: bool, manifest: bool) -> Optional[List[Dict[str, object]]]:
    source_path = sheet_image_path(sheet_index).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f'Source sheet not found: {source_path}')

    output_dir = output_dir_for_sheet(sheet_index).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries: List[Dict[str, object]] = []

    with Image.open(source_path) as sheet:
        sheet_width, sheet_height = sheet.size

        print(f'Extracting monster_sheet_{sheet_index} from {source_path}')
        print(f'Sheet size: {sheet_width} x {sheet_height}')
        print(f'Grid: {TOTAL_ROWS} rows x {TOTAL_COLS} cols')
        print(f'Cell size: {CELL_WIDTH} x {CELL_HEIGHT}')
        print(f'Output directory: {output_dir}')
        print(f'Clamp mode: {clamp}')

        for row in range(TOTAL_ROWS):
            y_pos = START_Y + (row * STRIDE_Y)
            for col in range(TOTAL_COLS):
                x_pos = START_X + (col * STRIDE_X)
                x_end = x_pos + CELL_WIDTH
                y_end = y_pos + CELL_HEIGHT

                if x_pos < 0 or y_pos < 0:
                    raise ValueError(
                        f'Invalid negative origin for row={row}, col={col}: ({x_pos},{y_pos})'
                    )

                if x_end > sheet_width or y_end > sheet_height:
                    if clamp:
                        x_end = min(x_end, sheet_width)
                        y_end = min(y_end, sheet_height)
                        print(
                            f'Clamped out-of-bounds crop for row={row}, col={col}: '
                            f'({x_pos},{y_pos},{x_end},{y_end})'
                        )
                    else:
                        raise ValueError(
                            f'Crop out of bounds for row={row}, col={col}: '
                            f'({x_pos},{y_pos},{x_end},{y_end}) vs sheet {sheet_width}x{sheet_height}'
                        )

                cropped = sheet.crop((x_pos, y_pos, x_end, y_end))
                if cropped.size != (CELL_WIDTH, CELL_HEIGHT):
                    if clamp:
                        padded = Image.new('RGBA', (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
                        padded.paste(cropped, (0, 0))
                        cropped = padded
                    else:
                        raise ValueError(
                            f'Unexpected cropped size {cropped.size} for row={row}, col={col}'
                        )

                file_name = f'monster_{sheet_index}_{row}_{col}.png'
                output_path = output_dir / file_name
                cropped.save(output_path)

                if manifest:
                    center_x = x_pos + (CELL_WIDTH / 2.0)
                    center_y = y_pos + (CELL_HEIGHT / 2.0)
                    manifest_entries.append(build_manifest_entry(
                        file_name=file_name,
                        row=row,
                        col=col,
                        x_pos=x_pos,
                        y_pos=y_pos,
                        width=CELL_WIDTH,
                        height=CELL_HEIGHT,
                        center_x=center_x,
                        center_y=center_y,
                    ))

                print(f'Wrote {output_path.name} top_left=({x_pos},{y_pos}) center=({x_pos + CELL_WIDTH/2.0:.2f},{y_pos + CELL_HEIGHT/2.0:.2f})')

    if manifest:
        manifest_path = output_dir / f'monster_sheet_{sheet_index}_manifest.json'
        with manifest_path.open('w', encoding='utf-8') as handle:
            json.dump(manifest_entries, handle, indent=2)
        print(f'Manifest written to: {manifest_path}')

    return manifest_entries if manifest else None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Extract cells from monster_sheet_1/2/3 and write per-sheet manifests.'
    )
    parser.add_argument('--sheet', type=int, choices=[1, 2, 3], help='The monster sheet number to extract.')
    parser.add_argument('--all', action='store_true', help='Extract all monster sheets 1, 2, and 3.')
    parser.add_argument('--clamp', action='store_true', help='Clamp crops to the image bounds if needed.')
    parser.add_argument('--manifest', action='store_true', help='Write JSON manifests for extracted cells.')
    args = parser.parse_args()

    if not args.sheet and not args.all:
        parser.error('Either --sheet or --all must be specified.')

    sheets = [args.sheet] if args.sheet else [1, 2, 3]
    for sheet_index in sheets:
        extract_sheet(sheet_index, clamp=args.clamp, manifest=args.manifest)

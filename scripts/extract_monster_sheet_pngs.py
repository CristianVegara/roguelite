#!/usr/bin/env python3
"""Split monster_spreadsheet.png into three engine-ready monster sheet PNGs.

Each output sheet is derived from a 9-row × 10-column sprite grid with
exact cell metrics to guarantee stable frame coordinates and center points.
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List
from PIL import Image

SOURCE_IMAGE = Path('src/assets/sprites/monster_spreadsheet.png')
OUTPUT_DIR = SOURCE_IMAGE.resolve().parent
FILE_PREFIX = 'monster_sheet'
TOTAL_ROWS = 9
TOTAL_COLS = 10
CELL_WIDTH = 125
CELL_HEIGHT = 89
START_X = 0
START_Y = 0
STRIDE_X = CELL_WIDTH
STRIDE_Y = CELL_HEIGHT
SHEETS = 3
ROWS_PER_SHEET = TOTAL_ROWS // SHEETS


def build_sheet_name(sheet_index: int) -> str:
    return f'{FILE_PREFIX}_{sheet_index + 1}.png'


def build_manifest_entry(
    sheet_name: str,
    row: int,
    col: int,
    x: int,
    y: int,
    width: int,
    height: int,
    center_x: float,
    center_y: float,
) -> Dict[str, object]:
    return {
        'sheet': sheet_name,
        'row': row,
        'col': col,
        'top_left': [x, y],
        'bounding_box': [x, y, x + width, y + height],
        'center': [center_x, center_y],
        'width': width,
        'height': height,
    }


def split_sheets(clamp: bool, manifest: bool) -> List[Dict[str, object]]:
    source_path = SOURCE_IMAGE.resolve()
    if not source_path.exists():
        raise FileNotFoundError(f'Source spreadsheet not found: {source_path}')

    manifest_entries: List[Dict[str, object]] = []

    with Image.open(source_path) as sheet:
        sheet_width, sheet_height = sheet.size

        print(f'Source image: {source_path}')
        print(f'Sheet size: {sheet_width} x {sheet_height}')
        print(f'Grid: {TOTAL_ROWS} rows x {TOTAL_COLS} cols')
        print(f'Cell size: {CELL_WIDTH} x {CELL_HEIGHT}')
        print(f'Output directory: {OUTPUT_DIR}')

        for sheet_index in range(SHEETS):
            top_row = sheet_index * ROWS_PER_SHEET
            sheet_top = START_Y + top_row * STRIDE_Y
            output_width = TOTAL_COLS * CELL_WIDTH
            output_height = ROWS_PER_SHEET * CELL_HEIGHT
            output_image = Image.new('RGBA', (output_width, output_height), (0, 0, 0, 0))
            output_name = build_sheet_name(sheet_index)
            output_path = OUTPUT_DIR / output_name

            for row_index in range(ROWS_PER_SHEET):
                global_row = top_row + row_index
                y_pos = START_Y + (global_row * STRIDE_Y)
                for col_index in range(TOTAL_COLS):
                    x_pos = START_X + (col_index * STRIDE_X)
                    x_end = x_pos + CELL_WIDTH
                    y_end = y_pos + CELL_HEIGHT

                    if x_pos < 0 or y_pos < 0:
                        raise ValueError(
                            f'Invalid negative origin for row={global_row}, col={col_index}: '
                            f'({x_pos},{y_pos})'
                        )

                    if x_end > sheet_width or y_end > sheet_height:
                        if clamp:
                            x_end = min(x_end, sheet_width)
                            y_end = min(y_end, sheet_height)
                            print(
                                f'Clamped out-of-bounds crop for row={global_row}, col={col_index}: '
                                f'({x_pos},{y_pos},{x_end},{y_end})'
                            )
                        else:
                            raise ValueError(
                                f'Crop out of bounds for row={global_row}, col={col_index}: '
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
                                f'Unexpected cropped size {cropped.size} for row={global_row}, col={col_index}'
                            )

                    paste_x = col_index * CELL_WIDTH
                    paste_y = row_index * CELL_HEIGHT
                    output_image.paste(cropped, (paste_x, paste_y))

                    if manifest:
                        entry = build_manifest_entry(
                            sheet_name=output_name,
                            row=global_row,
                            col=col_index,
                            x=x_pos,
                            y=y_pos,
                            width=CELL_WIDTH,
                            height=CELL_HEIGHT,
                            center_x=x_pos + (CELL_WIDTH / 2.0),
                            center_y=y_pos + (CELL_HEIGHT / 2.0),
                        )
                        manifest_entries.append(entry)

            output_image.save(output_path)
            print(f'Wrote {output_path} ({output_width}x{output_height})')

    if manifest:
        manifest_path = OUTPUT_DIR / f'{FILE_PREFIX}_manifest.json'
        with manifest_path.open('w', encoding='utf-8') as handle:
            json.dump(manifest_entries, handle, indent=2)
        print(f'Manifest written to: {manifest_path}')

    return manifest_entries


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Split monster_spreadsheet.png into monster_sheet_1.png, monster_sheet_2.png, and monster_sheet_3.png.'
    )
    parser.add_argument('--clamp', action='store_true', help='Clamp crops to the source boundary if needed.')
    parser.add_argument('--manifest', action='store_true', help='Write a JSON manifest for the generated sheets.')
    args = parser.parse_args()

    split_sheets(clamp=args.clamp, manifest=args.manifest)

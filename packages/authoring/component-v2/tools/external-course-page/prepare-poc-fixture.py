#!/usr/bin/env python3
"""Prepare a small, isolated fixture around a read-only course distribution."""

from __future__ import annotations

import hashlib
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


CHAPTER_ID = '01_introduction'
PAGE_ID = 'page112'


def link_path(source: Path, destination: Path) -> None:
    """Links one read-only source path into the disposable fixture."""
    destination.symlink_to(source, target_is_directory=source.is_dir())


def write_reduced_summary(source: Path, destination: Path) -> None:
    """Writes the original menu and only the selected chapter and page."""
    tree = ET.parse(source)
    menu = tree.getroot()
    chapters = [chapter for chapter in menu if chapter.get('id') == CHAPTER_ID]
    if len(chapters) != 1:
        raise ValueError(f'Expected one chapter {CHAPTER_ID}; found {len(chapters)}.')
    chapter = chapters[0]
    pages = [page for page in chapter if page.get('id') == PAGE_ID]
    if len(pages) != 1:
        raise ValueError(f'Expected one page {PAGE_ID}; found {len(pages)}.')
    page = pages[0]

    for other_chapter in list(menu):
        if other_chapter is not chapter:
            menu.remove(other_chapter)
    for other_page in list(chapter):
        if other_page is not page:
            chapter.remove(other_page)

    ET.indent(tree, space='  ')
    tree.write(destination, encoding='utf-8', xml_declaration=True)


def write_embedded_entry(source: Path, destination: Path, bridge: Path) -> None:
    """Copies the original entry with the bridge before its application module."""
    document = source.read_text(encoding='utf-8')
    bridge_version = hashlib.sha256(bridge.read_bytes()).hexdigest()[:12]
    bridge_url = f'./embedded-reader-bridge.js?v={bridge_version}'
    entry_pattern = re.compile(r'<script\b[^>]*\bsrc=["\']\./static/js/index\.js["\'][^>]*>', re.IGNORECASE)
    document, entry_count = entry_pattern.subn(
        lambda match: f'<script src="{bridge_url}"></script>\n' + match.group(0),
        document,
        count=1,
    )
    if entry_count != 1:
        raise ValueError('Could not locate the original application module entry.')
    embed_style = '<style id="external-course-embed-style">#container-nav{display:none!important}</style>'
    document, head_count = re.subn(r'</head\s*>', f'{embed_style}\n</head>', document, count=1, flags=re.IGNORECASE)
    if head_count != 1:
        raise ValueError('Could not locate the document head close tag.')
    destination.write_text(document, encoding='utf-8')
    shutil.copy2(bridge, destination.parent / 'embedded-reader-bridge.js')


def prepare_fixture(source_dist: Path, fixture_dir: Path) -> None:
    """Builds the fixture using links for source assets and generated launch files."""
    source_dist = source_dist.resolve(strict=True)
    index_path = source_dist / 'index.html'
    content_path = source_dist / 'content'
    xml_path = content_path / 'xml'
    if not index_path.is_file() or not xml_path.is_dir():
        raise ValueError('The source distribution must contain index.html and content/xml.')

    fixture_dir.mkdir(parents=True, exist_ok=True)
    if any(fixture_dir.iterdir()):
        raise ValueError(f'The fixture target must be empty: {fixture_dir}')

    for source_entry in source_dist.iterdir():
        if source_entry.name == 'content':
            continue
        link_path(source_entry, fixture_dir / source_entry.name)

    fixture_content = fixture_dir / 'content'
    fixture_xml = fixture_content / 'xml'
    fixture_xml.mkdir(parents=True)
    for source_entry in content_path.iterdir():
        if source_entry.name == 'xml':
            continue
        link_path(source_entry, fixture_content / source_entry.name)
    for source_entry in xml_path.iterdir():
        link_path(source_entry, fixture_xml / source_entry.name)

    write_reduced_summary(xml_path / 'summary.xml', fixture_xml / 'summary-poc.xml')
    write_embedded_entry(index_path, fixture_dir / 'index-embedded.html', Path(__file__).with_name('embedded-reader-bridge.js'))


def main(arguments: list[str]) -> int:
    """Checks the two paths and prepares the isolated course-reader fixture."""
    if len(arguments) != 3:
        print('Usage: prepare-poc-fixture.py SOURCE_DIST FIXTURE_DIR', file=sys.stderr)
        return 2
    try:
        prepare_fixture(Path(arguments[1]), Path(arguments[2]))
    except (OSError, ValueError, ET.ParseError) as error:
        print(f'Could not prepare fixture: {error}', file=sys.stderr)
        return 1
    print(f'Prepared course-reader fixture at {Path(arguments[2]).resolve()}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))

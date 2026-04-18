import os
import re
import html as html_module
import urllib.parse
import urllib.request
from collections import deque


PAGE_URL = "https://www.facebook.com/klyaksa2020/photos"
MBASIC_PAGE_URL = "https://mbasic.facebook.com/klyaksa2020/photos"
OUTPUT_DIR = os.path.join(os.getcwd(), "images")
NAME_PREFIX = "klyaksa-photo-"


def fetch_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=40) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def extract_image_urls(html: str) -> list[str]:
    patterns = [
        r"https://[^\"' <>\n\r]*fbcdn\.net[^\"' <>\n\r]*\.(?:jpg|jpeg|png)[^\"' <>\n\r]*",
        r"https:\\/\\/[^\"\\]+fbcdn\.net[^\"\\]+\\.(?:jpg|jpeg|png)[^\"\\]*",
    ]
    raw: list[str] = []
    for pattern in patterns:
        raw.extend(re.findall(pattern, html, flags=re.IGNORECASE))

    urls = [html_module.unescape(u.replace("\\/", "/")) for u in raw]

    cleaned: list[str] = []
    seen: set[str] = set()
    for url in urls:
        # Drop tiny icons/sprites where possible and keep CDN images only.
        if "scontent" not in url:
            continue
        if url in seen:
            continue
        seen.add(url)
        cleaned.append(url)
    return cleaned


def extract_links_for_crawl(page_url: str, html: str) -> list[str]:
    hrefs = re.findall(r'href="([^"]+)"', html)
    links: list[str] = []
    for href in hrefs:
        href = html_module.unescape(href.replace("\\/", "/"))
        absolute = urllib.parse.urljoin(page_url, href)
        if "mbasic.facebook.com" not in absolute:
            continue
        if "/klyaksa2020/photos" in absolute or "/photo.php?" in absolute or "v=photos" in absolute:
            links.append(absolute)
    # Deduplicate while preserving order
    dedup: list[str] = []
    seen: set[str] = set()
    for link in links:
        if link not in seen:
            seen.add(link)
            dedup.append(link)
    return dedup


def crawl_for_image_urls(start_url: str, max_pages: int = 25) -> list[str]:
    visited: set[str] = set()
    queue = deque([start_url])
    all_urls: list[str] = []
    seen_image_urls: set[str] = set()

    while queue and len(visited) < max_pages:
        url = queue.popleft()
        if url in visited:
            continue
        visited.add(url)
        try:
            html = fetch_text(url)
        except Exception as err:
            print(f"Skip page {url} -> {err}")
            continue

        image_urls = extract_image_urls(html)
        for image_url in image_urls:
            if image_url in seen_image_urls:
                continue
            seen_image_urls.add(image_url)
            all_urls.append(image_url)

        for link in extract_links_for_crawl(url, html):
            if link not in visited:
                queue.append(link)

    return all_urls


def detect_extension(url: str) -> str:
    path = urllib.parse.urlparse(url).path.lower()
    if path.endswith(".png"):
        return ".png"
    if path.endswith(".jpeg"):
        return ".jpeg"
    return ".jpg"


def download_image(url: str, output_path: str) -> None:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=40) as resp:
        data = resp.read()
    with open(output_path, "wb") as f:
        f.write(data)


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    urls: list[str] = []

    try:
        urls.extend(crawl_for_image_urls(MBASIC_PAGE_URL, max_pages=30))
    except Exception as err:
        print(f"mbasic crawl failed: {err}")

    if not urls:
        html = fetch_text(PAGE_URL)
        urls = extract_image_urls(html)

    # Final dedupe
    dedup_urls: list[str] = []
    seen_urls: set[str] = set()
    for url in urls:
        if url in seen_urls:
            continue
        seen_urls.add(url)
        dedup_urls.append(url)
    urls = dedup_urls

    print(f"Found candidate URLs: {len(urls)}")

    if not urls:
        print("No image URLs found on the page.")
        return

    downloaded = 0
    for idx, url in enumerate(urls, start=1):
        ext = detect_extension(url)
        filename = f"{NAME_PREFIX}{idx:03d}{ext}"
        output_path = os.path.join(OUTPUT_DIR, filename)
        try:
            download_image(url, output_path)
            downloaded += 1
            print(f"Downloaded: {filename}")
        except Exception as err:
            print(f"Failed: {filename} -> {err}")

    print(f"Done. Downloaded {downloaded} of {len(urls)} files.")


if __name__ == "__main__":
    main()

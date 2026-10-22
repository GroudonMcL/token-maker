// The image proxy's request/response shapes (DESIGN.md §7), shared by the
// Pages Functions and the editor.

/** An image found on a web page. Width/height are hints from the page, when it gives them. */
export interface FoundImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

/** What GET /api/page-images?url=… answers. */
export type PageImagesResult =
  /** The address is itself an image: load it with /api/fetch-image. */
  | { kind: 'image'; url: string }
  /** A normal page: let the user pick one of `images`. */
  | { kind: 'page'; url: string; title: string; images: FoundImage[] }
  /** A Pinterest pin: `images` are the pin's main image, best (largest) first. */
  | { kind: 'pinterest'; url: string; title: string; images: FoundImage[] };

export type ApiErrorCode =
  | 'bad_url'
  | 'blocked'
  | 'too_large'
  | 'timeout'
  | 'network'
  | 'site_refused'
  | 'not_found'
  | 'site_error'
  | 'too_many_redirects'
  | 'not_image'
  | 'not_page'
  | 'no_images'
  | 'pinterest_board'
  | 'rate_limited'
  | 'forbidden';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; retryAfter?: number };
}

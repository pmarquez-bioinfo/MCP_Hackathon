export interface SpotifySearchParams {
  q: string; // The search query, required
  type?: (
    | 'album'
    | 'artist'
    | 'playlist'
    | 'track'
    | 'show'
    | 'episode'
    | 'audiobook'
  )[]; // Required
  market?: string; // Optional: An ISO 3166-1 alpha-2 country code or "from_token"
  limit?: number; // Optional: Max number of results (1–50, default 20)
  offset?: number; // Optional: Index of the first result to return (default 0)
  include_external?: 'audio'; // Optional: Only 'audio' is valid
}

export interface SpotifySearchResultItem {
  name: string;
  artist: string;
  album: string;
  uri: string;
  id: string;
  image?: { url: string; width: number; height: number };
  href?: string;
}

export interface SpotifyStartPlaybackBody {
  context_uri?: string;
  uris?: string[];
  offset?: {
    position?: number;
    uri?: string;
  };
  position_ms?: number;
}

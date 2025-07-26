import {
  SpotifySearchParams,
  SpotifySearchResultItem,
  SpotifyStartPlaybackBody,
} from './dto';

export enum ApiMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export class Spotify {
  private static async callWithTokenRefresh(call: Function): Promise<any> {
    let response = await call();
    if (response.status === 401) {
      if (!process.env.SPOTIFY_REFRESH_TOKEN) {
        throw new Error(
          'SPOTIFY_REFRESH_TOKEN is not set in environment variables.'
        );
      }
      const body = new URLSearchParams();
      body.append('grant_type', 'refresh_token');
      body.append('refresh_token', process.env.SPOTIFY_REFRESH_TOKEN);
      const { access_token } = await Spotify.call(
        ApiMethod.POST,
        { genericApp: true },
        {
          url: 'https://accounts.spotify.com/api/token',
          body,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      process.env.SPOTIFY_USER_BEARER_TOKEN = access_token;
      response = await call();
    }
    return response;
  }

  private static async call(
    method: ApiMethod,
    auth: {
      genericApp?: boolean;
      user?: boolean;
    },
    options: {
      url: string;
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<any> {
    const headers = new Headers();
    // headers.append('Content-Type', 'application/x-www-form-urlencoded');

    if (auth.genericApp) {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64'
      );

      headers.append('Authorization', `Basic ${credentials}`);
    } else if (auth.user) {
      const bearerToken = process.env.SPOTIFY_USER_BEARER_TOKEN;
      if (!bearerToken) {
        throw new Error(
          'SPOTIFY_USER_BEARER_TOKEN is not set in environment variables.'
        );
      }
      headers.append('Authorization', `Bearer ${bearerToken}`);
    }

    for (const [key, value] of Object.entries(options.headers || {})) {
      headers.append(key, value);
    }

    const requestOptions = {
      method: method,
      headers: headers,
      body: options.body,
    };

    const response = await this.callWithTokenRefresh(
      async () => await fetch(options.url, requestOptions)
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  static async search(
    options: SpotifySearchParams
  ): Promise<SpotifySearchResultItem[]> {
    options.type ??= ['track']; // Default to 'track' if no type is provided

    // Build query parameters
    const searchParams = new URLSearchParams();
    if (options.q) searchParams.append('q', options.q);
    if (options.type) searchParams.append('type', options.type.join(','));
    if (options.limit) searchParams.append('limit', options.limit.toString());
    if (options.offset)
      searchParams.append('offset', options.offset.toString());
    if (options.market) searchParams.append('market', options.market);

    const data = await Spotify.call(
      ApiMethod.GET,
      { user: true },
      {
        url: `https://api.spotify.com/v1/search?${searchParams.toString()}`,
      }
    );

    return data.tracks.items.map((track: any) => ({
      name: track.name,
      artist: track.artists[0]?.name ?? '', // first artist
      album: track.album.name,
      uri: track.uri,
      id: track.id,
      image: track.album.images[0],
      href: track.href, // optional: direct API endpoint to the track
    }));
  }

  static async playTrack(
    playbackOptions: SpotifyStartPlaybackBody,
    device_id?: string
  ): Promise<void> {
    await Spotify.call(
      ApiMethod.PUT,
      { user: true },
      {
        url: `https://api.spotify.com/v1/me/player/play${
          device_id ? `?device_id=${device_id}` : ''
        }`,
        body: JSON.stringify(playbackOptions),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// const headers = new Headers();
// headers.append(
//   'Authorization',
//   'Bearer BQDcLSvrSEJoEPgKT2WTiONY5dT6pPLHSxWSm_fEOyh2xPybkfnyjd9UGfXnpI64734TmzT-4ySYNNdoJSdYg_ZJWcNBYSh4Ewm9RA8MRKKMQ5kwKJQm9cUxjFI7OjFRvtAuIigOOfE'
// );

// const requestOptions = {
//   method: 'GET',
//   headers: headers,
//   redirect: 'follow',
// };

// fetch(
//   'https://api.spotify.com/v1/search?q=track:blinding+lights%20artist:the+weeknd&type=track&limit=1',
//   requestOptions
// )
//   .then((response) => response.text())
//   .then((result) => console.log(result))
//   .catch((error) => console.error(error));

import {
  SpotifySearchParams,
  SpotifySearchResultItem,
  SpotifyStartPlaybackBody,
} from './dto';
import fs from 'fs/promises';

export enum ApiMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

let tokens = { userBearerToken: process.env.SPOTIFY_USER_BEARER_TOKEN };

export class Spotify {
  private static async refreshToken(): Promise<void> {
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
    tokens.userBearerToken = access_token;
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
      if (!tokens.userBearerToken) {
        throw new Error(
          'SPOTIFY_USER_BEARER_TOKEN is not set in environment variables.'
        );
      }
      // await fs.writeFile(
      //   `./${new Date().toISOString()}.json`,
      //   JSON.stringify(tokens, null, 2)
      // );
      headers.append('Authorization', `Bearer ${tokens.userBearerToken}`);
    }

    for (const [key, value] of Object.entries(options.headers || {})) {
      headers.append(key, value);
    }

    const requestOptions = {
      method: method,
      headers: headers,
      body: options.body,
    };

    let response = await fetch(options.url, requestOptions);

    if (response.status === 401) {
      await Spotify.refreshToken();
      headers.set('Authorization', `Bearer ${tokens.userBearerToken}`);
    }

    response = await fetch(options.url, requestOptions);
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
    fs.writeFile(
      './playbackOptions.json',
      JSON.stringify(playbackOptions, null, 2)
    );
    if (
      playbackOptions.offset &&
      Object.keys(playbackOptions.offset).length === 0
    ) {
      delete playbackOptions.offset; // Remove empty offset
    }
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

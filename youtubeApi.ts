export type YouTubePrivacyStatus = 'private' | 'unlisted' | 'public';

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

export interface YouTubePublishResult {
  videoId: string;
  watchUrl: string;
  captionsAttached: boolean;
  thumbnailAttached: boolean;
}

export async function fetchMyYouTubeChannel(
  accessToken: string,
): Promise<YouTubeChannelInfo | null> {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg =
      (errBody as {error?: {message?: string}}).error?.message ||
      'Unable to read YouTube channel details.';
    throw new Error(msg);
  }
  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        thumbnails?: {default?: {url?: string}};
      };
    }>;
  };
  const first = data.items?.[0];
  if (!first?.id) return null;
  return {
    id: first.id,
    title: first.snippet?.title || 'Connected Channel',
    thumbnailUrl: first.snippet?.thumbnails?.default?.url,
  };
}

export async function uploadVideoToYouTube(params: {
  accessToken: string;
  videoBlob: Blob;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: YouTubePrivacyStatus;
  srtText?: string;
  thumbnailBlob?: Blob | null;
}): Promise<YouTubePublishResult> {
  const {
    accessToken,
    videoBlob,
    title,
    description,
    tags,
    privacyStatus,
    srtText,
    thumbnailBlob,
  } = params;

  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description: description.slice(0, 5000),
      tags: tags.slice(0, 20),
      categoryId: '22',
    },
    status: {
      privacyStatus,
    },
  };

  const boundary = `prime_yt_${Date.now().toString(36)}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}`;

  const mediaHeader = `${delimiter}Content-Type: ${videoBlob.type || 'video/webm'}\r\n\r\n`;
  const multipartBlob = new Blob([metadataPart, mediaHeader, videoBlob, closeDelimiter], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    },
  );

  if (!uploadRes.ok) {
    const errJson = await uploadRes.json().catch(() => ({}));
    const msg =
      (errJson as {error?: {message?: string}}).error?.message ||
      `YouTube upload failed (${uploadRes.status}).`;
    throw new Error(msg);
  }

  const uploaded = (await uploadRes.json()) as {id?: string};
  const videoId = uploaded.id;
  if (!videoId) {
    throw new Error('YouTube API did not return a video ID.');
  }

  let captionsAttached = false;
  if (srtText && srtText.trim().length > 0) {
    try {
      const capBoundary = `prime_cap_${Date.now().toString(36)}`;
      const capMeta = {
        snippet: {
          videoId,
          language: 'en',
          name: 'Auto Captions',
          isDraft: false,
        },
      };
      const capBody = new Blob(
        [
          `\r\n--${capBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(capMeta)}`,
          `\r\n--${capBoundary}\r\nContent-Type: application/octet-stream\r\n\r\n${srtText}`,
          `\r\n--${capBoundary}--`,
        ],
        {type: `multipart/related; boundary=${capBoundary}`},
      );
      const capRes = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${capBoundary}`,
          },
          body: capBody,
        },
      );
      captionsAttached = capRes.ok;
    } catch {
      captionsAttached = false;
    }
  }

  let thumbnailAttached = false;
  if (thumbnailBlob) {
    try {
      const thumbRes = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': thumbnailBlob.type || 'image/jpeg',
          },
          body: thumbnailBlob,
        },
      );
      thumbnailAttached = thumbRes.ok;
    } catch {
      thumbnailAttached = false;
    }
  }

  return {
    videoId,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    captionsAttached,
    thumbnailAttached,
  };
}

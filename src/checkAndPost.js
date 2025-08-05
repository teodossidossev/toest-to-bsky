import { google } from 'googleapis';
import { AtpAgent } from '@atproto/api';

const CHANNEL_ID = process.env.CHANNEL_ID;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BSKY_USERNAME = process.env.BSKY_USERNAME;
const BSKY_APP_PASSWORD = process.env.BSKY_APP_PASSWORD;

// Look back period in days
const LOOKBACK_DAYS = 7;

async function getLatestVideo() {
    console.info('Start youtube check')
    const youtube = google.youtube({ version: 'v3' });

    const response = await youtube.search.list({
        key: YOUTUBE_API_KEY,
        channelId: CHANNEL_ID,
        order: 'date',
        part: 'snippet',
        maxResults: 1,
        publishedAfter: new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
    }, {
        otherArgs: {
            headers: {
                'X-Goog-Api-Key': YOUTUBE_API_KEY
            }
        }
    });

    if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0];
    }
    return null;
}

async function postToBsky(video) {
    console.info('Publish')
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({
        identifier: BSKY_USERNAME,
        password: BSKY_APP_PASSWORD,
    });

    // thumb
    const thumbRes = await fetch(video.snippet.thumbnails.medium.url);
    const thumbBuffer = await thumbRes.arrayBuffer();
    const thumbBlob = new Blob([thumbBuffer], { type: 'image/jpeg' });
    const uploadResult = await agent.uploadBlob(thumbBlob);
    const thumbBlobRef = uploadResult.data.blob;

    // video
    const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
    const postText = `(bot) Новo видео Т.Е. от Е.Т.: ${videoUrl}`;
    const title = video.snippet.title;
    const description = video.snippet.description;

    await agent.com.atproto.repo.createRecord({
        repo: BSKY_USERNAME,
        collection: 'app.bsky.feed.post',
        record: {
            text: postText,
            createdAt: new Date().toISOString(),
            embed: {
                $type: 'app.bsky.embed.external',
                external: {
                    uri: videoUrl,
                    title,
                    description,
                    thumb: thumbBlobRef
                }
            }
        }
    });

    console.info('Finish');
}

(async () => {
    try {
        const video = await getLatestVideo();
        if (video) {
            await postToBsky(video);
            console.log('Posted to Bluesky:', video.id.videoId);
        } else {
            console.log('No new videos found this week.');
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();

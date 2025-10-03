import { google } from 'googleapis';
import { AtpAgent } from '@atproto/api';
import fs from 'fs/promises';
import path from 'path';

const CHANNEL_ID = process.env.CHANNEL_ID;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BSKY_USERNAME = process.env.BSKY_USERNAME;
const BSKY_APP_PASSWORD = process.env.BSKY_APP_PASSWORD;

// Look back period in days
const LOOKBACK_DAYS = 2;

// File used to store already-posted video IDs to avoid duplicates
const POSTED_DB = path.resolve(process.cwd(), 'posted.json');

async function loadPostedIds() {
    try {
        const data = await fs.readFile(POSTED_DB, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
            return new Set(parsed);
        }
        return new Set();
    } catch (_err) {
        return new Set();
    }
}

async function savePostedIds(set) {
    const arr = Array.from(set);
    const tmp = `${POSTED_DB}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(arr, null, 2), 'utf-8');
    await fs.rename(tmp, POSTED_DB);
}

function titleMatches(video) {
    const title = video?.snippet?.title || '';
    return title.startsWith('Т.Е. от Е.Т');
}

function isPublishedTodayInSofia(isoDateString) {
    const fmt = new Intl.DateTimeFormat('bg-BG', {
        timeZone: 'Europe/Sofia',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const today = fmt.format(new Date());
    const published = fmt.format(new Date(isoDateString));
    return today === published;
}

async function getVideosSince(publishedAfterIso) {
    const youtube = google.youtube({ version: 'v3' });
    const all = [];
    let pageToken = undefined;

    do {
        const response = await youtube.search.list({
            key: YOUTUBE_API_KEY,
            channelId: CHANNEL_ID,
            order: 'date',
            part: 'snippet',
            maxResults: 50,
            publishedAfter: publishedAfterIso,
            type: 'video',
            pageToken
        }, {
            otherArgs: {
                headers: {
                    'X-Goog-Api-Key': YOUTUBE_API_KEY
                }
            }
        });

        if (response.data.items && response.data.items.length > 0) {
            all.push(...response.data.items);
        }
        pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return all;
}

async function getTodaysMatchingVideos() {
    const publishedAfterIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const items = await getVideosSince(publishedAfterIso);

    const todays = items.filter(v => {
        const pa = v?.snippet?.publishedAt;
        if (!pa) {
            return false;
        }
        return isPublishedTodayInSofia(pa) && titleMatches(v);
    });

    todays.sort((a, b) => {
        const ta = new Date(a.snippet.publishedAt).getTime();
        const tb = new Date(b.snippet.publishedAt).getTime();
        return tb - ta;
    });

    return todays;
}

async function postToBsky(video) {
    console.info('Publish');
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
    const postText = `(bot) Ново видео Т.Е. от Е.Т.: ${videoUrl}`;
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
        const posted = await loadPostedIds();

        const candidates = await getTodaysMatchingVideos();

        if (candidates.length === 0) {
            console.log('No matching videos today (Europe/Sofia).');
            process.exit(0);
        }

        const toPost = candidates.find(v => {
            const id = v?.id?.videoId;
            if (!id) {
                return false;
            }
            return !posted.has(id);
        });

        if (!toPost) {
            console.log('All matching videos for today are already posted. Skipping.');
            process.exit(0);
        }

        await postToBsky(toPost);

        const id = toPost.id.videoId;
        posted.add(id);
        await savePostedIds(posted);

        console.log('Posted to Bluesky:', id);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();

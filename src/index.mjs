import { writeFileSync } from 'fs';
import dotenv from 'dotenv';
import Jimp from 'jimp';
dotenv.config();
import postHistory from '../posthistory.json' assert { type: 'json' };

const mastodonHeaders = {
    Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`,
};

const authTags = `api_key=${process.env.DANBOORU_API_KEY}&login=${process.env.DANBOORU_USERNAME}`;

async function main() {
    const tags = `yuri rating:general status:active upvotes:>=10 order:random -is:banned -meme -baalbuddy`;
    let uniquePost = false;
    let post;
    while (!uniquePost) {
        post = await fetchRandomPost(tags);
        if (!postHistory.includes(post.id)) {
            postHistory.push(post.id);
            uniquePost = true;
        }
    }
    writeFileSync('./posthistory.json', JSON.stringify(postHistory, null, 4));
    const postTags = post.tag_string.split(' ').join(', ').split('_').join(' ');
    const isSensitive = post.rating !== 'g';
    const rating = {
        g: 'General',
        s: 'Sensitive',
        q: 'Questionable',
        e: 'Explicit',
    }[post.rating] || 'Unknown';
    log('Danbooru Post', post);

    const artists = await fetchArtistNames(post.tag_string_artist);
    log('Danbooru Artists', artists);

    const img = await fetchFileSource(post.file_url);
    log('File Buffer', img.getWidth() + 'x' + img.getHeight());

    const mediaId = await uploadMedia(img, postTags);
    log('Mastodon Media', mediaId);

    const status = await postToMastodon(post, isSensitive, rating, artists, mediaId);
    log('Mastodon Status', status);
}

await main();

/**
 * Fetches a random post from Danbooru with the given tags.
 */
async function fetchRandomPost(searchTags) {
    const res = await fetch(`https://danbooru.donmai.us/posts.json?${authTags}&tags=${searchTags.split(' ').join('+')}&limit=1`);
    return (await res.json())[0];
}

/**
 * Fetches the artist's name(s) from Danbooru.
 */
async function fetchArtistNames(name) {
    const danbooruArtistResponse = await fetch(`https://danbooru.donmai.us/artists.json?${authTags}&search[name]=${name.split(' ').join('+')}`);
    const danbooruArtists = await danbooruArtistResponse.json();
    return danbooruArtists.map(artist => artist.name.replaceAll('_', ' ')).join(', ');
}

/**
 * Fetches the image URL and converts to JPEG with 95% quality.
 */
async function fetchFileSource(url) {
    const img = await Jimp.read(url);
    img.quality(95);
    return img;
}

/**
 * Uploads the image to Mastodon.
 */
async function uploadMedia(img, postTags, retryCount = 0) {
    const mediaFormData = new FormData();
    mediaFormData.append('file', await img.getBufferAsync(Jimp.MIME_JPEG).then(buffer => new Blob([buffer], { type: 'image/jpeg' })));
    mediaFormData.append('description', 'Danbooru tags: ' + postTags);

    const mediaResponse = await fetch('https://botsin.space/api/v2/media', {
        headers: mastodonHeaders,
        method: 'POST',
        body: mediaFormData,
    });

    const mediaResponseJson = await mediaResponse.json();

    if (mediaResponseJson.error) {
        console.error(mediaResponseJson.error);
        if (mediaResponseJson.error.includes('processing thumbnail')) {
            if (retryCount > 5) {
                throw new Error('Failed to upload media after 5 retries.');
            }
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Retry
            return uploadMedia(img, postTags, retryCount + 1);
        }
        throw new Error(mediaResponseJson.error);
    }

    const mediaId = mediaResponseJson.id;
    return mediaId;
}

/**
 * Creates a post on Mastodon.
 */
async function postToMastodon(post, isSensitive, rating, artists, mediaId) {
    const source = post.pixiv_id ? `https://www.pixiv.net/en/artworks/${post.pixiv_id}` : post.source;

    const postFormat = `Artist${artists.length > 1 ? 's' : ''}: ${artists}\nSource: ${source}`;
    
    const postFormData = new FormData();
    // postFormData.append('status', `Yuri!\n\nSource: ${post.source}`);
    postFormData.append('status', postFormat);
    postFormData.append('visibility', 'public');
    postFormData.append('media_ids[]', mediaId);
    postFormData.append('sensitive', isSensitive);
    
    const postResponse = await fetch('https://botsin.space/api/v1/statuses', {
        headers: mastodonHeaders,
        method: 'POST',
        body: postFormData,
    });
    return postResponse.json();
}

async function log(section, data) {
    console.log('-'.repeat(80));
    console.log(section);
    console.log('-'.repeat(80));
    console.log();
    console.log(data);
    console.log();
}

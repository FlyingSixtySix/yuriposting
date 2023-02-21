import dotenv from 'dotenv';
dotenv.config();

const mastodonHeaders = {
    Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`,
};

// 1. Fetch post from Danbooru

const danbooruAuthTags = `api_key=${process.env.DANBOORU_API_KEY}&login=${process.env.DANBOORU_USERNAME}`;
const danbooruTags = `yuri rating:general status:active upvotes:>=10 order:random -is:banned -meme`;

const danbooruResponse = await fetch(`https://danbooru.donmai.us/posts.json?${danbooruAuthTags}&tags=${danbooruTags.split(' ').join('+')}&limit=1`);
const danbooruPost = (await danbooruResponse.json())[0];

const friendlyTags = danbooruPost.tag_string.split(' ').join(', ').split('_').join(' ');

let isSensitive = true;
let rating = 'Unknown';
switch (danbooruPost.rating) {
    case 'g':
        rating = 'General';
        isSensitive = false;
        break;
    case 's':
        rating = 'Sensitive';
        break;
    case 'q':
        rating = 'Questionable';
        break;
    case 'e':
        rating = 'Explicit';
        break;
}

console.log('-'.repeat(80));
console.log('Danbooru Post');
console.log('-'.repeat(80));
console.log();
console.log(danbooruPost);
console.log();

// 1 and a half. Fetch artist name from Danbooru

const danbooruArtistResponse = await fetch(`https://danbooru.donmai.us/artists.json?${danbooruAuthTags}&search[name]=${danbooruPost.tag_string_artist.split(' ').join('+')}`);
const danbooruArtists = await danbooruArtistResponse.json();
const artists = danbooruArtists.map(artist => artist.name.replaceAll('_', ' ')).join(', ');

console.log('-'.repeat(80));
console.log('Danbooru Artists');
console.log('-'.repeat(80));
console.log();
console.log(danbooruArtists);
console.log();

// 2. Fetch file source from Danbooru

const fileResponse = await fetch(danbooruPost.file_url);

// 3. Upload file to Mastodon

const mediaFormData = new FormData();
mediaFormData.append('file', await fileResponse.blob());
mediaFormData.append('description', 'Danbooru tags: ' + friendlyTags);

const mediaResponse = await fetch('https://botsin.space/api/v2/media', {
    headers: mastodonHeaders,
    method: 'POST',
    body: mediaFormData,
});
const mediaResponseJson = await mediaResponse.json();
const mediaId = mediaResponseJson.id;

console.log('-'.repeat(80));
console.log('Media Response');
console.log('-'.repeat(80));
console.log();
console.log(mediaResponseJson);
console.log();

// 4. Post to Mastodon

const source = danbooruPost.pixiv_id ? `https://www.pixiv.net/en/artworks/${danbooruPost.pixiv_id}` : danbooruPost.source;

const postFormat = `
Artist${danbooruArtists.length > 1 ? 's' : ''}: ${artists}
Source: ${source}
Rating: ${rating}
`.trim();

const postFormData = new FormData();
// postFormData.append('status', `Yuri!\n\nSource: ${danbooruPost.source}`);
postFormData.append('status', postFormat);
postFormData.append('visibility', 'public');
postFormData.append('media_ids[]', mediaId);
postFormData.append('sensitive', isSensitive);

const postResponse = await fetch('https://botsin.space/api/v1/statuses', {
    headers: mastodonHeaders,
    method: 'POST',
    body: postFormData,
});
const postResponseJson = await postResponse.json();

console.log('-'.repeat(80));
console.log('Post Response');
console.log('-'.repeat(80));
console.log();
console.log(postResponseJson);
console.log();

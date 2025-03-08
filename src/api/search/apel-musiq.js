const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

app.get('/search/apple-music', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ status: false, error: 'Query is required' });
    }

    try {
        const response = await axios.get(`https://music.apple.com/id/search?term=${encodeURIComponent(q)}`);
        const $ = cheerio.load(response.data);
        const searchResults = [];

        $(".shelf-grid__body ul li .track-lockup").each((index, element) => {
            const title = $(element).find(".track-lockup__content li").eq(0).find("a").text().trim();
            const album = $(element).find(".track-lockup__content li").eq(0).find("a").attr("href");
            const crop = album.split("/").pop();
            const songUrl = album.replace(crop, "").trim().replace("/album/", "/song/").trim() + album.split("i=")[1];
            const image = $(element).find(".svelte-3e3mdo source").eq(1).attr("srcset").split(",")[1].split(" ")[0].trim();
            const artist = {
                name: $(element).find(".track-lockup__content li").eq(1).find("a").text().trim(),
                url: $(element).find(".track-lockup__content li").eq(1).find("a").attr("href"),
            };

            searchResults.push({
                title,
                image,
                song: songUrl,
                artist,
            });
        });

        res.status(200).json({ status: true, result: searchResults });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

app.get('/download/apple-music', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ status: false, error: 'URL is required' });
    }

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const json = JSON.parse($("script").eq(0).text());
        const info = {
            metadata: {},
            download: {},
        };

        delete json.audio["@type"];
        delete json.audio.audio;
        delete json.audio.inAlbum["@type"];
        delete json.audio.inAlbum.byArtist;
        json.audio.artist = json.audio.byArtist[0];
        delete json.audio.artist["@type"];
        delete json.audio.byArtist;
        info.metadata = json.audio;

        const apiResponse = await axios.get("https://aaplmusicdownloader.com/api/composer/ytsearch/mytsearch.php", {
            params: {
                name: info.metadata.name,
                artist: info.metadata.artist.name,
                album: info.metadata.inAlbum.name,
                link: info.metadata.url,
            },
        });

        if (!apiResponse.data.videoid) {
            return res.status(404).json({ status: false, error: 'Download link not found' });
        }

        const downloadResponse = await axios.get(`https://aaplmusicdownloader.com/api/ytdl.php?q=${apiResponse.data.videoid}`);
        info.download = downloadResponse.data.dlink;

        res.status(200).json({ status: true, result: info });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

module.exports = app;

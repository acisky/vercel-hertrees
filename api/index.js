const express = require("express");
const path = require("path");
const fs = require("fs").promises; // Use fs.promises for async operations
const fsSync = require("fs"); // Keep a sync version for readdir
require("dotenv").config();
const app = express();
const cookieParser = require("cookie-parser");

const marked = require("marked");
const yamlFront = require("yaml-front-matter");

const gamesPath = path.join(__dirname, "games");
const games = fsSync.readdirSync(gamesPath).filter((f) => f.endsWith(".md"));

app.set("view engine", "ejs");
app.engine("ejs", require("ejs").__express);
app.set("views", path.join(__dirname, "./views"));
app.use(express.static("public"));

app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.render('index',{topGames: games,newGames:games});
});

games.forEach((filename) => {
  app.get(`/${path.parse(filename).name}`, async (req, res) => {
    try {
      const filePath = path.join(gamesPath, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const { __content, ...metadata } = yamlFront.loadFront(fileContent);
      const htmlContent = marked.parse(__content);

      const gameList = await Promise.all(
        games.map(async (filename) => {
          const filePath = path.join(gamesPath, filename);
          const fileContent = await fs.readFile(filePath, "utf-8");
          const { __content, ...metadata } = yamlFront.loadFront(fileContent);
          return metadata;
        })
      ).then(list => list.sort((a, b) => b.top || 0 - a.top || 0));;

      res.render("game", {
        metadata,
        content: htmlContent,
        gameList
      });
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
      res.status(500).send("Internal Server Error");
    }
  });
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
    const gameUrls = await Promise.all(games.map(async filename => {
      const filePath = path.join(gamesPath, filename);
      const stats = await fs.stat(filePath);
      return {
        url: `${baseUrl}/${path.parse(filename).name}`,
        lastmod: stats.mtime.toISOString().split('T')[0],
        priority: 0.8
      };
    }));

    const staticUrls = [
      { url: baseUrl, lastmod: new Date().toISOString().split('T')[0], priority: 1.0 },
      { url: `${baseUrl}/new-games`, lastmod: new Date().toISOString().split('T')[0], priority: 0.9 },
      { url: `${baseUrl}/sprunki-all-phases`, lastmod: new Date().toISOString().split('T')[0], priority: 0.9 }
    ];

    const allUrls = [...staticUrls, ...gameUrls];

    res.header('Content-Type', 'application/xml');
    res.render('sitemap', { urls: allUrls });
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Internal Server Error");
  }
});

const port = process.env.PORT || 3000;


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

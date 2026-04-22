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

const topGamesArr = ["her-trees-first-puzzle", "her-trees-the-puzzle-house", "creepy-dates", "penultima"];

async function getGameList() {
  const list = await Promise.all(
    games.map(async (filename) => {
      const filePath = path.join(gamesPath, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const { __content, ...metadata } = yamlFront.loadFront(fileContent);
      return { ...metadata, slug: path.parse(filename).name };
    }),
  );
  return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

app.get("/", async (req, res) => {
  const gameList = await getGameList();

  const topGames = topGamesArr
    .map((slug) => gameList.find((game) => game.slug === slug))
    .filter((game) => game !== undefined);
  const newGames = gameList.filter((game) => !topGamesArr.includes(game.slug)).slice(0, 8);
  res.render("index", { topGames, newGames });
});

function extractDescription(htmlContent) {
  // 排除h2和h3标签及其内容
  const cleanHtml = htmlContent.replace(/<h[23][^>]*>[\s\S]*?<\/h[23]>/gi, "");
  // 删除所有HTML标签
  const plainText = cleanHtml.replace(/<[^>]+>/g, "");
  // 截取前160个字符
  return plainText.substring(0, 160).trim();
}

games.forEach((filename) => {
  app.get(`/${path.parse(filename).name}`, async (req, res) => {
    try {
      const filePath = path.join(gamesPath, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const { __content, ...metadata } = yamlFront.loadFront(fileContent);
      metadata.slug = path.parse(filename).name;
      const htmlContent = marked.parse(__content);

      const gameList = await getGameList();

      const topGames = topGamesArr
        .map((slug) => gameList.find((game) => game.slug === slug))
        .filter((game) => game !== undefined);
      const newGames = gameList.filter((game) => !topGamesArr.includes(game.slug)).slice(0, 8);

      res.render("game", {
        metadata,
        content: htmlContent,
        description: extractDescription(htmlContent),
        gameList,
        topGames,
        newGames,
      });
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get(`/${path.parse(filename).name}.embed`, async (req, res) => {
    try {
      const filePath = path.join(gamesPath, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const { __content, ...metadata } = yamlFront.loadFront(fileContent);
      metadata.slug = path.parse(filename).name;

      res.render("embed", {
        metadata,
      });
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
      res.status(500).send("Internal Server Error");
    }
  });
});

app.get("/new-games", async (req, res) => {
  const gameList = await getGameList();
  res.render("newgames", { newGames: gameList });
});

app.get("/aboutus", (req, res) => {
  res.render("aboutus");
});

app.get("/contactus", (req, res) => {
  res.render("contactus");
});

app.get("/dmca", (req, res) => {
  res.render("dmca");
});

app.get("/privacypolicy", (req, res) => {
  res.render("privacypolicy");
});

app.get("/termsofservices", (req, res) => {
  res.render("termsofservices");
});

app.get("/game-sitemap.xml", async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
    const gameUrls = await Promise.all(
      games.map(async (filename) => {
        const filePath = path.join(gamesPath, filename);
        const stats = await fs.stat(filePath);
        return {
          url: `${baseUrl}/${path.parse(filename).name}`,
          lastmod: stats.mtime.toISOString().split("T")[0],
          priority: 0.8,
        };
      }),
    );

    const staticUrls = [
      { url: baseUrl, lastmod: new Date().toISOString().split("T")[0], priority: 1.0 },
      { url: `${baseUrl}/new-games`, lastmod: new Date().toISOString().split("T")[0], priority: 0.9 },
      { url: `${baseUrl}/sprunki-all-phases`, lastmod: new Date().toISOString().split("T")[0], priority: 0.9 },
    ];

    const allUrls = [...staticUrls, ...gameUrls];

    res.header("Content-Type", "application/xml");
    res.render("sitemap", { urls: allUrls });
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Internal Server Error");
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

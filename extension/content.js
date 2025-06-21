console.log("✅ content.js loaded");

let lastURL = location.href;

// 👇 Function to send content to background script
function sendContent(type, content) {
  console.log("📤 Sending content:", { type, url: location.href });
  chrome.runtime.sendMessage({
    type: "NEW_CONTENT",
    url: location.href,
    title: document.title,
    kind: type,
    text: content
  }, (res) => {
    console.log("📨 Background response:", res);
  });
}

// 👇 Extract content if it's a YouTube video
function extractYouTubeContent() {
  console.log("📺 Detected YouTube video page");

  let attempts = 0;

  const interval = setInterval(() => {
    const h1Title = document.querySelector("h1.title")?.innerText?.trim();
    const metaTitle = document.querySelector('meta[name="title"]')?.content?.trim();
    const realTitle = h1Title || metaTitle || document.title;

    const description =
      document.querySelector("#description")?.innerText?.trim() ||
      document.querySelector('meta[name="description"]')?.content?.trim() ||
      "";

    const content = `${realTitle || ""}\n\n${description || ""}`.trim();

    if ((realTitle && realTitle !== "YouTube") || description) {
      clearInterval(interval);
      console.log("🎯 YouTube video content extracted:", content.slice(0, 300));
      sendContent("video", content);
    }

    attempts++;
    if (attempts >= 20) {
      clearInterval(interval);
      console.warn("⏳ Timeout: Couldn't extract YouTube title/description");
    }
  }, 1000); // try every 1s, up to 20s
}

// 👇 Extract content from article/blog pages
function extractArticleContent() {
  const articleText = Array.from(document.querySelectorAll("p"))
    .map(p => p.innerText.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 3000);

  if (articleText.length > 0) {
    console.log("📰 Article content extracted");
    sendContent("article", articleText);
  } else {
    console.log("❌ No article content found");
  }
}

// 👇 Master function to decide what to extract
function extractAndSendContent() {
  console.log("🚦 Checking page type:", location.href);
  if (location.href.includes("youtube.com/watch")) {
    extractYouTubeContent();
  } else {
    extractArticleContent();
  }
}

// 👇 Listen for SPA-style URL changes
setInterval(() => {
  if (location.href !== lastURL) {
    console.log("🔁 URL changed! Re-running content check...");
    lastURL = location.href;
    extractAndSendContent();
  }
}, 1000);

// 👇 Initial run
extractAndSendContent();

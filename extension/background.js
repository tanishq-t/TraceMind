console.log("🛠️ Background service worker is alive!");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📬 Received message:", message);

  if (message.type === "NEW_CONTENT") {
    console.log("📄 New content captured:", message.kind, message.url);
    console.log("🧠 Content to summarize:\n", message.text.slice(0, 300));

    chrome.storage.local.set({
      [message.url]: {
        title: message.title,
        type: message.kind,
        text: message.text
      }
    });

    sendResponse({ status: "✅ Stored in local storage" });
  }
});

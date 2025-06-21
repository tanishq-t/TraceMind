chrome.storage.local.get(null, (data) => {
    const ul = document.getElementById("list");
    Object.entries(data).forEach(([url, { title }]) => {
      const li = document.createElement("li");
      li.innerText = `${title} (${url})`;
      ul.appendChild(li);
    });
  });
  
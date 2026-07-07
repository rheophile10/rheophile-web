(function () {
  const POSTS_URL = '/assets/blog-posts.json';

  function ensureCardStyles() {
    if (document.getElementById('blog-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'blog-ui-styles';
    style.textContent = `
      .post-card {
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 0.2s ease;
      }
      .post-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        border-color: #14b8a6;
      }
      .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  async function fetchBlogPosts() {
    const res = await fetch(POSTS_URL);
    if (!res.ok) throw new Error('Failed to load blog posts');
    const data = await res.json();
    return data.posts || [];
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPostCard(post) {
    ensureCardStyles();
    const a = document.createElement('a');
    a.href = post.href;
    a.className = 'post-card block rounded-3xl border border-white/10 bg-zinc-900/70 p-6 group no-underline text-inherit';
    a.innerHTML = `
      <div class="flex justify-between items-baseline text-xs">
        <span class="text-teal-400 font-medium">${escapeHtml(post.date)}</span>
        <span class="text-zinc-600 group-hover:text-zinc-500">${escapeHtml(post.tags.join(' · '))}</span>
      </div>
      <div class="mt-2.5 text-xl tracking-tighter font-semibold leading-tight group-hover:text-teal-400 transition">${escapeHtml(post.title)}</div>
      <p class="mt-3 text-sm text-zinc-400 line-clamp-3">${escapeHtml(post.excerpt)}</p>
      <div class="mt-5 text-xs text-teal-400 flex items-center gap-1">
        Read note <span class="transition group-hover:translate-x-0.5">→</span>
      </div>
    `;
    return a;
  }

  function renderEmptyState(container) {
    container.innerHTML = `
      <div class="md:col-span-2 rounded-3xl border border-dashed border-white/15 bg-zinc-900/40 p-10 text-center">
        <div class="text-2xl tracking-tighter font-semibold text-zinc-300">Coming soon</div>
        <p class="mt-2 text-sm text-zinc-500">Notes on building plastron in the open will land here.</p>
      </div>
    `;
  }

  function renderPostGrid(container, posts) {
    container.innerHTML = '';
    if (!posts.length) {
      renderEmptyState(container);
      return;
    }
    posts.forEach(post => container.appendChild(renderPostCard(post)));
  }

  async function renderDevLogGrid(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const posts = await fetchBlogPosts();
    renderPostGrid(container, posts);
  }

  async function renderRelatedPosts(containerId, currentSlug) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const posts = await fetchBlogPosts();
    const related = posts.filter(p => p.slug !== currentSlug);
    renderPostGrid(container, related);
  }

  window.BlogUI = {
    fetchBlogPosts,
    renderPostCard,
    renderPostGrid,
    renderDevLogGrid,
    renderRelatedPosts,
  };
})();
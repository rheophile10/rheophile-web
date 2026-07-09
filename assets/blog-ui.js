(function () {
  const POSTS_URL = '/assets/blog-posts.json';
  const PROJECTS_URL = '/assets/projects.json';

  function ensureCardStyles() {
    if (document.getElementById('blog-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'blog-ui-styles';
    style.textContent = `
      .post-card, .project-card {
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 0.2s ease;
      }
      .post-card { position: relative; }
      .post-card:hover, .project-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        border-color: #14b8a6;
      }
      /* Whole-card click target while keeping a single semantic heading link */
      .stretched-link::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 1;
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

  function renderPostCard(post, opts) {
    ensureCardStyles();
    const h = (opts && opts.headingLevel) || 'h3';
    const article = document.createElement('article');
    article.className = 'post-card group block rounded-3xl border border-white/10 bg-zinc-900/70 p-6';
    article.innerHTML = `
      <div class="flex justify-between items-baseline text-xs">
        <time datetime="${escapeHtml(post.date)}" class="text-teal-400 font-medium">${escapeHtml(post.date)}</time>
        <span class="text-zinc-600 group-hover:text-zinc-500">${escapeHtml(post.tags.join(' · '))}</span>
      </div>
      <${h} class="mt-2.5 text-xl tracking-tighter font-semibold leading-tight">
        <a href="${escapeHtml(post.href)}" class="stretched-link no-underline text-inherit group-hover:text-teal-400 transition">${escapeHtml(post.title)}</a>
      </${h}>
      <p class="mt-3 text-sm text-zinc-400 line-clamp-3">${escapeHtml(post.excerpt)}</p>
      <div class="mt-5 text-xs text-teal-400 flex items-center gap-1">
        Read note <span aria-hidden="true" class="transition group-hover:translate-x-0.5">→</span>
      </div>
    `;
    return article;
  }

  function renderEmptyState(container) {
    container.innerHTML = `
      <div class="md:col-span-2 rounded-3xl border border-dashed border-white/15 bg-zinc-900/40 p-10 text-center">
        <div class="text-2xl tracking-tighter font-semibold text-zinc-300">Coming soon</div>
        <p class="mt-2 text-sm text-zinc-500">Notes on building plastron in the open will land here.</p>
      </div>
    `;
  }

  function renderPostGrid(container, posts, opts) {
    container.innerHTML = '';
    if (!posts.length) {
      renderEmptyState(container);
      return;
    }
    posts.forEach(post => container.appendChild(renderPostCard(post, opts)));
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

  // ---- Tag-filterable blog index ------------------------------------------

  function uniqueTags(posts) {
    const seen = new Set();
    posts.forEach(p => (p.tags || []).forEach(t => seen.add(t)));
    return [...seen].sort((a, b) => a.localeCompare(b));
  }

  function currentTagFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('tag') || '';
  }

  function renderTagFilter(filterEl, gridEl, posts, activeTag) {
    const tags = uniqueTags(posts);
    const chips = ['', ...tags];

    function draw() {
      const active = currentTagFromUrl();
      filterEl.innerHTML = '';
      chips.forEach(tag => {
        const label = tag || 'All';
        const isActive = tag === active;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.tag = tag;
        btn.setAttribute('aria-pressed', String(isActive));
        btn.className = 'px-3 py-1 rounded-full text-xs font-medium border transition-colors ' +
          (isActive
            ? 'bg-teal-500 text-zinc-950 border-teal-500'
            : 'bg-white/5 text-zinc-300 border-white/10 hover:border-teal-500/50 hover:text-white');
        btn.textContent = tag ? `#${label}` : label;
        btn.addEventListener('click', () => {
          const url = new URL(window.location.href);
          if (tag) url.searchParams.set('tag', tag);
          else url.searchParams.delete('tag');
          window.history.replaceState({}, '', url);
          draw();
          drawGrid();
        });
        filterEl.appendChild(btn);
      });
    }

    function drawGrid() {
      const active = currentTagFromUrl();
      const filtered = active ? posts.filter(p => (p.tags || []).includes(active)) : posts;
      renderPostGrid(gridEl, filtered, { headingLevel: 'h2' });
    }

    draw();
    drawGrid();
  }

  async function renderBlogIndex(gridId, filterId) {
    const gridEl = document.getElementById(gridId);
    const filterEl = document.getElementById(filterId);
    if (!gridEl) return;
    const posts = await fetchBlogPosts();
    if (filterEl) {
      renderTagFilter(filterEl, gridEl, posts, currentTagFromUrl());
    } else {
      renderPostGrid(gridEl, posts, { headingLevel: 'h2' });
    }
  }

  // ---- Projects grid -------------------------------------------------------

  async function fetchProjects() {
    const res = await fetch(PROJECTS_URL);
    if (!res.ok) throw new Error('Failed to load projects');
    const data = await res.json();
    return data.projects || [];
  }

  function renderProjectCard(project) {
    ensureCardStyles();
    const card = document.createElement('article');
    card.className = 'project-card rounded-3xl border border-white/10 bg-zinc-900/60 p-6 flex flex-col';

    const links = [];
    if (project.repo) {
      links.push(`<a href="${escapeHtml(project.repo)}" target="_blank" rel="noopener" class="text-teal-400 hover:text-teal-300 transition">Source <span aria-hidden="true">↗</span></a>`);
    }
    if (project.live) {
      links.push(`<a href="${escapeHtml(project.live)}" target="_blank" rel="noopener" class="text-teal-400 hover:text-teal-300 transition">Live <span aria-hidden="true">↗</span></a>`);
    }
    if (project.blog) {
      links.push(`<a href="${escapeHtml(project.blog)}" class="text-teal-400 hover:text-teal-300 transition">Read <span aria-hidden="true">→</span></a>`);
    }

    card.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="text-2xl leading-none" aria-hidden="true">${escapeHtml(project.emoji || '📦')}</span>
          <h4 class="font-semibold tracking-tight text-lg truncate">${escapeHtml(project.name)}</h4>
        </div>
        <span class="shrink-0 text-[10px] uppercase tracking-widest text-zinc-400 px-2 py-0.5 rounded-full border border-white/10">${escapeHtml(project.lang || '')}</span>
      </div>
      <p class="mt-3 text-sm text-zinc-400 leading-relaxed flex-1">${escapeHtml(project.tagline || '')}</p>
      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
        ${links.join('')}
      </div>
    `;
    return card;
  }

  async function renderProjectsGrid(containerId, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const options = opts || {};
    const projects = await fetchProjects();
    const list = options.includeFeatured ? projects : projects.filter(p => !p.featured);
    container.innerHTML = '';
    list.forEach(p => container.appendChild(renderProjectCard(p)));
  }

  window.BlogUI = {
    fetchBlogPosts,
    renderPostCard,
    renderPostGrid,
    renderDevLogGrid,
    renderRelatedPosts,
    renderBlogIndex,
    uniqueTags,
    fetchProjects,
    renderProjectCard,
    renderProjectsGrid,
  };
})();
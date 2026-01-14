const body = document.body;
const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
const navLinks = nav ? Array.from(nav.querySelectorAll('a')) : [];

const hero = document.getElementById('hero');
const layers = Array.from(document.querySelectorAll('[data-speed]'));
const scenes = Array.from(document.querySelectorAll('[data-scene]'));
const boat = document.getElementById('boat');
const boatWrap = document.querySelector('.boat-overlay');
const toursSection = document.getElementById('tours');

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = reduceMotionQuery.matches;

let latestScroll = window.scrollY;
let boatPos = 0;
let pauseUntil = 0;
let rafId = null;
let metrics = {
  heroTop: 0,
  heroHeight: 0,
  docHeight: 0,
  pauseStart: 0,
  pauseEnd: 0,
  baseBoat: 0,
  boatTravel: 0,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, t) => start + (end - start) * t;

const setReducedMotion = (value) => {
  reduceMotion = value;
  body.classList.toggle('reduced-motion', reduceMotion);
};

const closeNav = () => {
  body.classList.remove('nav-open');
  if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'false');
  }
};

const recalc = () => {
  metrics.heroTop = hero ? hero.offsetTop : 0;
  metrics.heroHeight = hero ? hero.offsetHeight : 1;
  metrics.docHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  metrics.baseBoat = window.innerHeight * 0.12;
  metrics.boatTravel = window.innerHeight * 0.55;

  if (toursSection) {
    metrics.pauseStart = toursSection.offsetTop - window.innerHeight * 0.6;
    metrics.pauseEnd = toursSection.offsetTop + window.innerHeight * 0.2;
  }
};

const updateParallax = (time) => {
  const scrollY = latestScroll;
  const heroProgress = hero
    ? clamp((scrollY - metrics.heroTop) / metrics.heroHeight, 0, 1)
    : 0;
  const scrollProgress = clamp(scrollY / metrics.docHeight, 0, 1);
  const motionScale = reduceMotion ? 0.2 : 1;
  const mobileScale = window.innerWidth < 768 ? 0.4 : 1;
  const parallaxScale = motionScale * mobileScale;

  layers.forEach((layer) => {
    const speed = parseFloat(layer.dataset.speed) || 0.2;
    const offset = (scrollY - metrics.heroTop) * speed * parallaxScale;
    layer.style.transform = `translate3d(-50%, ${offset}px, 0)`;
  });

  scenes.forEach((scene) => {
    const start = parseFloat(scene.dataset.start) || 0;
    const end = parseFloat(scene.dataset.end) || 1;
    const shift = parseFloat(scene.dataset.shift) || 60;
    const t = clamp((heroProgress - start) / (end - start), 0, 1);
    const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
    const direction = scene.classList.contains('scene-left') ? -1 : 1;
    const x = direction * (1 - phase) * shift;
    const y = (1 - phase) * 10;
    scene.style.opacity = phase.toFixed(3);
    scene.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });

  if (boat && boatWrap) {
    const targetBoat = metrics.baseBoat + scrollProgress * metrics.boatTravel;
    const inPause = scrollY > metrics.pauseStart && scrollY < metrics.pauseEnd;
    const inTimedPause = time < pauseUntil;
    const smooth = reduceMotion ? 0.2 : inTimedPause ? 0.02 : inPause ? 0.03 : 0.12;
    boatPos = lerp(boatPos, targetBoat, smooth);

    const bob = reduceMotion ? 0 : Math.sin(time / 850) * 6;
    const tilt = reduceMotion ? 0 : Math.sin(time / 1100) * 1.4;
    boat.style.transform = `translate3d(-50%, ${boatPos + bob}px, 0) rotate(${tilt}deg)`;

    const fade = clamp(1 - heroProgress * 0.45, 0.2, 1);
    boatWrap.style.opacity = fade.toFixed(2);
  }

  if (header) {
    header.classList.toggle('scrolled', scrollY > 12);
  }
};

const onScroll = () => {
  latestScroll = window.scrollY;
};

const animate = (time) => {
  updateParallax(time);
  rafId = window.requestAnimationFrame(animate);
};

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const isOpen = body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    if (body.classList.contains('nav-open')) {
      closeNav();
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeNav();
  }
});

reduceMotionQuery.addEventListener('change', (event) => {
  setReducedMotion(event.matches);
});

window.addEventListener('resize', () => {
  recalc();
  onScroll();
});

window.addEventListener('scroll', onScroll, { passive: true });

const init = () => {
  setReducedMotion(reduceMotionQuery.matches);
  recalc();
  boatPos = metrics.baseBoat;
  onScroll();
  if (!rafId) {
    rafId = window.requestAnimationFrame(animate);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (toursSection && 'IntersectionObserver' in window) {
  const tourObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          pauseUntil = performance.now() + 700;
        }
      });
    },
    { threshold: 0.3 }
  );
  tourObserver.observe(toursSection);
}

const carousel = document.querySelector('[data-carousel]');
if (carousel) {
  const track = carousel.querySelector('[data-track]');
  const cards = track ? Array.from(track.children) : [];
  const prevBtn = carousel.querySelector('[data-prev]');
  const nextBtn = carousel.querySelector('[data-next]');
  let index = 0;
  let cardsPerView = 1;
  let cardWidth = 0;

  const updateCarousel = () => {
    const maxIndex = Math.max(0, cards.length - cardsPerView);
    index = clamp(index, 0, maxIndex);
    if (track) {
      track.style.transform = `translate3d(${-index * cardWidth}px, 0, 0)`;
    }
    if (prevBtn) {
      prevBtn.disabled = index === 0;
    }
    if (nextBtn) {
      nextBtn.disabled = index === maxIndex;
    }
  };

  const layoutCarousel = () => {
    cardsPerView = window.innerWidth >= 980 ? 2 : 1;
    cardWidth = carousel.clientWidth / cardsPerView;
    cards.forEach((card) => {
      card.style.minWidth = `${cardWidth}px`;
    });
    updateCarousel();
  };

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      index -= 1;
      updateCarousel();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      index += 1;
      updateCarousel();
    });
  }

  window.addEventListener('resize', layoutCarousel);
  layoutCarousel();
}

const faqItems = Array.from(document.querySelectorAll('.faq-item'));
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (item.open) {
      faqItems.forEach((other) => {
        if (other !== item) {
          other.open = false;
        }
      });
    }
  });
});

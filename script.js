const body = document.body;
const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
const navLinks = nav ? Array.from(nav.querySelectorAll('a')) : [];

const story = document.querySelector('.story');
const storyStage = document.querySelector('.story-stage');
const storyLayers = Array.from(document.querySelectorAll('[data-depth]'));
const storyBoat = document.querySelector('.story-boat');
const storyCards = Array.from(document.querySelectorAll('.story-card'));
const storySteps = Array.from(document.querySelectorAll('.story-step'));

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = reduceMotionQuery.matches;

const TUNING = {
  lerp: {
    parallax: 0.08, // higher = snappier, lower = smoother
    boat: 0.1, // boat inertia during regular steps
    boatSlow: 0.05, // boat inertia on the slow step
  },
  parallax: {
    maxShift: 140, // px total travel for the nearest layer
  },
  boat: {
    baseY: 0.58, // stage height ratio for the boat anchor
    travel: 0.12, // extra vertical travel across the story
    driftX: 18, // px side drift
    bobY: 8, // px vertical bob
    tilt: 1.4, // degrees of tilt
    driftSpeedX: 4200, // ms cycle length
    driftSpeedY: 2800, // ms cycle length
  },
  motionScale: {
    mobile: 0.5, // reduce motion on small screens
    reduced: 0.2, // reduce parallax when prefers-reduced-motion
  },
};

let latestScroll = window.scrollY;
let targetProgress = 0;
let smoothProgress = 0;
let boatPos = 0;
let activeStep = -1;
let slowStepIndex = -1;
let rafId = null;
let useStepFallback = true;
let metrics = {
  storyTop: 0,
  storyHeight: 0,
  stageHeight: 0,
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
  if (!story || !storyStage) {
    return;
  }
  metrics.storyTop = story.offsetTop;
  metrics.storyHeight = story.offsetHeight;
  metrics.stageHeight = storyStage.offsetHeight;
};

const setActiveStep = (index) => {
  if (!storyCards.length) {
    return;
  }
  const nextIndex = clamp(index, 0, storyCards.length - 1);
  if (nextIndex === activeStep) {
    return;
  }
  activeStep = nextIndex;
  storyCards.forEach((card, cardIndex) => {
    const isActive = cardIndex === activeStep;
    card.classList.toggle('is-active', isActive);
    card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
};

const updateStoryTargets = () => {
  if (!story) {
    return;
  }
  const maxScroll = Math.max(metrics.storyHeight - window.innerHeight, 1);
  targetProgress = clamp((latestScroll - metrics.storyTop) / maxScroll, 0, 1);

  if (useStepFallback && storySteps.length) {
    const fallbackIndex = Math.round(targetProgress * (storySteps.length - 1));
    setActiveStep(fallbackIndex);
  }
};

const updateStory = (time) => {
  if (!storyStage) {
    return;
  }
  const motionScale = reduceMotion ? TUNING.motionScale.reduced : 1;
  const mobileScale = window.innerWidth < 768 ? TUNING.motionScale.mobile : 1;
  const parallaxScale = motionScale * mobileScale;
  const lerpFactor = reduceMotion ? 0.2 : TUNING.lerp.parallax;

  smoothProgress = lerp(smoothProgress, targetProgress, lerpFactor);

  storyLayers.forEach((layer) => {
    const depth = parseFloat(layer.dataset.depth) || 0.2;
    const offset = smoothProgress * TUNING.parallax.maxShift * depth * parallaxScale;
    layer.style.transform = `translate3d(-50%, ${offset}px, 0)`;
  });

  if (storyBoat) {
    const base = metrics.stageHeight * TUNING.boat.baseY;
    const travel = metrics.stageHeight * TUNING.boat.travel;
    const targetBoat = base + smoothProgress * travel;
    const boatLerp = reduceMotion
      ? 0.2
      : activeStep === slowStepIndex
        ? TUNING.lerp.boatSlow
        : TUNING.lerp.boat;
    boatPos = lerp(boatPos, targetBoat, boatLerp);

    const driftScale = reduceMotion ? 0 : parallaxScale;
    const driftX = Math.sin(time / TUNING.boat.driftSpeedX) * TUNING.boat.driftX * driftScale;
    const bob = Math.sin(time / TUNING.boat.driftSpeedY) * TUNING.boat.bobY * driftScale;
    const tilt = reduceMotion
      ? 0
      : Math.sin(time / (TUNING.boat.driftSpeedY * 1.2)) * TUNING.boat.tilt * driftScale;

    storyBoat.style.transform = `translate3d(calc(-50% + ${driftX}px), ${boatPos + bob}px, 0) rotate(${tilt}deg)`;
  }

  if (header) {
    header.classList.toggle('scrolled', latestScroll > 12);
  }
};

const onScroll = () => {
  latestScroll = window.scrollY;
  updateStoryTargets();
};

const animate = (time) => {
  updateStory(time);
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
  if (storyStage) {
    boatPos = metrics.stageHeight * TUNING.boat.baseY;
  }
  if (storySteps.length) {
    const slowStep = storySteps.find((step) => step.dataset.slow === 'true');
    slowStepIndex = slowStep ? Number.parseInt(slowStep.dataset.step, 10) : -1;
  }
  setActiveStep(0);
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

if (storySteps.length && 'IntersectionObserver' in window) {
  const stepRatios = new Map();
  const stepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const index = Number.parseInt(entry.target.dataset.step, 10);
        if (entry.isIntersecting) {
          stepRatios.set(index, entry.intersectionRatio);
        } else {
          stepRatios.delete(index);
        }
      });
      if (!stepRatios.size) {
        return;
      }
      const [nextIndex] = [...stepRatios.entries()].sort((a, b) => b[1] - a[1])[0];
      setActiveStep(nextIndex);
    },
    { threshold: 0.45, rootMargin: '-35% 0px -35% 0px' }
  );

  storySteps.forEach((step) => stepObserver.observe(step));
  useStepFallback = false;
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

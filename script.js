const body = document.body;
const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
const navLinks = nav ? Array.from(nav.querySelectorAll('a')) : [];

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = reduceMotionQuery.matches;

const TUNING = {
  motionScale: {
    mobile: 0.5, // reduce motion on smaller screens to avoid jitter
    reduced: 0.2, // global reduction for prefers-reduced-motion
  },
  story: {
    lerp: 0.08, // story parallax smoothing
    maxShift: 160, // max layer shift in px for nearest layer
    boat: {
      baseY: 0.58, // boat anchor position relative to stage height
      travel: 0.14, // boat travel across the story (ratio of stage height)
      lerp: 0.1, // boat inertia during regular steps
      lerpSlow: 0.05, // boat inertia during slow step
      driftX: 18, // px side drift
      bobY: 8, // px vertical bob
      tilt: 1.2, // degrees of tilt
      driftSpeedX: 4200, // ms per drift cycle
      driftSpeedY: 2800, // ms per bob cycle
    },
  },
  journey: {
    lerp: 0.09,
    maxShift: 110,
    boat: {
      baseY: 0.62,
      travel: 0.1,
      lerp: 0.1,
      lerpSlow: 0.06,
      driftX: 14,
      bobY: 6,
      tilt: 1,
      driftSpeedX: 4600,
      driftSpeedY: 3000,
    },
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, t) => start + (end - start) * t;

const setReducedMotion = (value) => {
  reduceMotion = value;
  body.classList.toggle('reduced-motion', reduceMotion);
};

const getMotionScale = () => {
  const baseScale = reduceMotion ? TUNING.motionScale.reduced : 1;
  const mobileScale = window.innerWidth < 768 ? TUNING.motionScale.mobile : 1;
  return baseScale * mobileScale;
};

const closeNav = () => {
  body.classList.remove('nav-open');
  if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'false');
  }
};

const updateHeader = (scrollY) => {
  if (header) {
    header.classList.toggle('scrolled', scrollY > 12);
  }
};

const blocks = [];
let latestScroll = window.scrollY;
let rafId = null;

const createStepObserver = (steps, onActive) => {
  if (!steps.length || !('IntersectionObserver' in window)) {
    return null;
  }
  const ratios = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const index = Number.parseInt(entry.target.dataset.step, 10);
        if (entry.isIntersecting) {
          ratios.set(index, entry.intersectionRatio);
        } else {
          ratios.delete(index);
        }
      });
      if (!ratios.size) {
        return;
      }
      const [nextIndex] = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
      onActive(nextIndex);
    },
    { threshold: [0.35, 0.6], rootMargin: '-35% 0px -35% 0px' }
  );

  steps.forEach((step) => observer.observe(step));
  return observer;
};

const createBlock = ({ root, stage, steps, onActive, update, reset }) => {
  if (!root) {
    return null;
  }

  const block = {
    root,
    stage,
    steps,
    onActive,
    update,
    reset,
    activeIndex: -1,
    targetProgress: 0,
    smoothProgress: 0,
    metrics: {
      top: 0,
      height: 1,
      maxScroll: 1,
      stageHeight: window.innerHeight,
    },
    useFallback: true,
    setActive(index) {
      if (!steps.length) {
        return;
      }
      const nextIndex = clamp(index, 0, steps.length - 1);
      if (nextIndex === block.activeIndex) {
        return;
      }
      block.activeIndex = nextIndex;
      if (typeof onActive === 'function') {
        onActive(nextIndex, block);
      }
    },
    updateMetrics() {
      block.metrics.top = root.offsetTop;
      block.metrics.height = root.offsetHeight;
      block.metrics.maxScroll = Math.max(root.offsetHeight - window.innerHeight, 1);
      block.metrics.stageHeight = stage ? stage.offsetHeight : window.innerHeight;
    },
    updateTarget(scrollY) {
      block.targetProgress = clamp((scrollY - block.metrics.top) / block.metrics.maxScroll, 0, 1);
      if (block.useFallback && steps.length) {
        const fallbackIndex = Math.round(block.targetProgress * (steps.length - 1));
        block.setActive(fallbackIndex);
      }
    },
  };

  block.observer = createStepObserver(steps, (index) => block.setActive(index));
  block.useFallback = !block.observer;

  return block;
};

const createStoryBlock = () => {
  const root = document.querySelector('.story');
  if (!root) {
    return null;
  }
  const stage = root.querySelector('.story-stage');
  const steps = Array.from(root.querySelectorAll('.story-step'));
  const cards = Array.from(root.querySelectorAll('.story-card'));
  const layers = stage ? Array.from(stage.querySelectorAll('[data-depth]')) : [];
  const boat = stage ? stage.querySelector('.story-boat') : null;
  const slowStep = steps.find((step) => step.dataset.slow === 'true');

  const state = {
    boatPos: 0,
    slowIndex: slowStep ? Number.parseInt(slowStep.dataset.step, 10) : -1,
  };

  const onActive = (index) => {
    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === index;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  };

  const update = (time, motionScale, block) => {
    const lerpFactor = reduceMotion ? 0.2 : TUNING.story.lerp;
    block.smoothProgress = lerp(block.smoothProgress, block.targetProgress, lerpFactor);

    const shift = TUNING.story.maxShift * motionScale;
    layers.forEach((layer) => {
      const depth = Number.parseFloat(layer.dataset.depth) || 0.2;
      const offset = block.smoothProgress * shift * depth;
      layer.style.transform = `translate3d(-50%, ${offset}px, 0)`;
    });

    if (!boat) {
      return;
    }

    const base = block.metrics.stageHeight * TUNING.story.boat.baseY;
    const travel = block.metrics.stageHeight * TUNING.story.boat.travel;
    const targetBoat = base + block.smoothProgress * travel;
    const boatLerp = reduceMotion
      ? 0.2
      : block.activeIndex === state.slowIndex
        ? TUNING.story.boat.lerpSlow
        : TUNING.story.boat.lerp;

    state.boatPos = lerp(state.boatPos, targetBoat, boatLerp);

    const driftScale = reduceMotion ? 0 : motionScale;
    const driftX = Math.sin(time / TUNING.story.boat.driftSpeedX) * TUNING.story.boat.driftX * driftScale;
    const bob = Math.sin(time / TUNING.story.boat.driftSpeedY) * TUNING.story.boat.bobY * driftScale;
    const tilt = reduceMotion
      ? 0
      : Math.sin(time / (TUNING.story.boat.driftSpeedY * 1.4)) * TUNING.story.boat.tilt * driftScale;

    boat.style.transform = `translate3d(calc(-50% + ${driftX}px), ${state.boatPos + bob}px, 0) rotate(${tilt}deg)`;
  };

  const reset = (block) => {
    state.boatPos = block.metrics.stageHeight * TUNING.story.boat.baseY;
  };

  const block = createBlock({ root, stage, steps, onActive, update, reset });
  if (block) {
    block.state = state;
  }
  return block;
};

const createGalleryBlock = () => {
  const root = document.querySelector('.gallery-story');
  if (!root) {
    return null;
  }
  const stage = root.querySelector('.gallery-stage');
  const steps = Array.from(root.querySelectorAll('.gallery-step'));
  const frames = Array.from(root.querySelectorAll('.gallery-frame'));

  const onActive = (index) => {
    frames.forEach((frame, frameIndex) => {
      const isActive = frameIndex === index;
      frame.classList.toggle('is-active', isActive);
      frame.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  };

  const update = () => {
    // Gallery animation is handled with CSS transitions on active frames.
  };

  return createBlock({ root, stage, steps, onActive, update });
};

const createJourneyBlock = () => {
  const root = document.querySelector('.journey-story');
  if (!root) {
    return null;
  }
  const stage = root.querySelector('.journey-stage');
  const steps = Array.from(root.querySelectorAll('.journey-step'));
  const cards = Array.from(root.querySelectorAll('.journey-card'));
  const layers = stage ? Array.from(stage.querySelectorAll('[data-depth]')) : [];
  const boat = stage ? stage.querySelector('.journey-boat') : null;
  const slowStep = steps.find((step) => step.dataset.slow === 'true');

  const state = {
    boatPos: 0,
    slowIndex: slowStep ? Number.parseInt(slowStep.dataset.step, 10) : -1,
  };

  const onActive = (index) => {
    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === index;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  };

  const update = (time, motionScale, block) => {
    const lerpFactor = reduceMotion ? 0.2 : TUNING.journey.lerp;
    block.smoothProgress = lerp(block.smoothProgress, block.targetProgress, lerpFactor);

    const shift = TUNING.journey.maxShift * motionScale;
    layers.forEach((layer) => {
      const depth = Number.parseFloat(layer.dataset.depth) || 0.2;
      const offset = block.smoothProgress * shift * depth;
      layer.style.transform = `translate3d(-50%, ${offset}px, 0)`;
    });

    if (!boat) {
      return;
    }

    const base = block.metrics.stageHeight * TUNING.journey.boat.baseY;
    const travel = block.metrics.stageHeight * TUNING.journey.boat.travel;
    const targetBoat = base + block.smoothProgress * travel;
    const boatLerp = reduceMotion
      ? 0.2
      : block.activeIndex === state.slowIndex
        ? TUNING.journey.boat.lerpSlow
        : TUNING.journey.boat.lerp;

    state.boatPos = lerp(state.boatPos, targetBoat, boatLerp);

    const driftScale = reduceMotion ? 0 : motionScale;
    const driftX = Math.sin(time / TUNING.journey.boat.driftSpeedX) * TUNING.journey.boat.driftX * driftScale;
    const bob = Math.sin(time / TUNING.journey.boat.driftSpeedY) * TUNING.journey.boat.bobY * driftScale;
    const tilt = reduceMotion
      ? 0
      : Math.sin(time / (TUNING.journey.boat.driftSpeedY * 1.4)) * TUNING.journey.boat.tilt * driftScale;

    boat.style.transform = `translate3d(calc(-50% + ${driftX}px), ${state.boatPos + bob}px, 0) rotate(${tilt}deg)`;
  };

  const reset = (block) => {
    state.boatPos = block.metrics.stageHeight * TUNING.journey.boat.baseY;
  };

  const block = createBlock({ root, stage, steps, onActive, update, reset });
  if (block) {
    block.state = state;
  }
  return block;
};

const onScroll = () => {
  latestScroll = window.scrollY;
  blocks.forEach((block) => block.updateTarget(latestScroll));
  updateHeader(latestScroll);
};

const recalc = () => {
  blocks.forEach((block) => block.updateMetrics());
  blocks.forEach((block) => block.updateTarget(latestScroll));
  blocks.forEach((block) => block.reset && block.reset(block));
};

const animate = (time) => {
  const motionScale = getMotionScale();
  blocks.forEach((block) => block.update(time, motionScale, block));
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

  const storyBlock = createStoryBlock();
  const galleryBlock = createGalleryBlock();
  const journeyBlock = createJourneyBlock();

  [storyBlock, galleryBlock, journeyBlock].forEach((block) => {
    if (block) {
      blocks.push(block);
    }
  });

  recalc();
  onScroll();

  blocks.forEach((block) => {
    if (block.activeIndex === -1) {
      block.setActive(0);
    }
  });

  if (!rafId) {
    rafId = window.requestAnimationFrame(animate);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
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

const modal = document.querySelector('[data-modal]');
const modalOpeners = Array.from(document.querySelectorAll('[data-modal-open]'));
const modalClosers = modal ? Array.from(modal.querySelectorAll('[data-modal-close]')) : [];
let lastFocusedElement = null;

const getFocusableElements = (element) =>
  Array.from(
    element.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );

const openModal = () => {
  if (!modal) {
    return;
  }
  lastFocusedElement = document.activeElement;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  body.classList.add('modal-open');
  const focusables = getFocusableElements(modal);
  if (focusables.length) {
    focusables[0].focus();
  }
};

const closeModal = () => {
  if (!modal) {
    return;
  }
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  body.classList.remove('modal-open');
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
};

const handleModalKeydown = (event) => {
  if (!modal || !modal.classList.contains('is-open')) {
    return;
  }
  if (event.key === 'Escape') {
    closeModal();
    return;
  }
  if (event.key !== 'Tab') {
    return;
  }
  const focusables = getFocusableElements(modal);
  if (!focusables.length) {
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const isShift = event.shiftKey;

  if (isShift && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!isShift && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

modalOpeners.forEach((opener) => {
  opener.addEventListener('click', (event) => {
    event.preventDefault();
    openModal();
  });
});

modalClosers.forEach((closer) => {
  closer.addEventListener('click', () => {
    closeModal();
  });
});

document.addEventListener('keydown', handleModalKeydown);

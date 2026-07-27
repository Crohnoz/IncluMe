(() => {
    "use strict";

    const root = document.documentElement;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const storageKey = "inclume.motion.reduced";

    function safeStorageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (_error) {
            return null;
        }
    }

    function safeStorageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (_error) {
            // Motion preferences remain available for the current page.
        }
    }

    function userReducedMotion() {
        const stored = safeStorageGet(storageKey);
        if (stored === "true") return true;
        if (stored === "false") return false;
        return reducedMotionQuery.matches;
    }

    function updateMotionState(reduced, { persist = false } = {}) {
        root.dataset.reducedMotion = reduced ? "true" : "false";
        if (persist) safeStorageSet(storageKey, String(reduced));

        const button = document.getElementById("motion-preference");
        if (!button) return;
        button.setAttribute("aria-pressed", String(reduced));
        button.querySelector(".motion-preference__label").textContent = reduced
            ? "Activar animaciones"
            : "Reducir animaciones";
        button.title = reduced
            ? "Las animaciones están reducidas en este dispositivo"
            : "Reducir movimientos y transiciones decorativas";
    }

    function prepareRevealTargets() {
        const selectors = [
            ".parking-toolbar__intro",
            ".parking-search-panel",
            ".priority-control",
            ".preference-summary",
            ".parking-view-switch",
            ".parking-results",
            ".parking-map-panel",
            ".hero",
            ".feature-card",
            ".resource-card",
            ".contact-card",
            ".site-footer__inner",
        ];

        const targets = [...document.querySelectorAll(selectors.join(","))];
        targets.forEach((node, index) => {
            node.dataset.reveal = "";
            node.style.setProperty("--reveal-delay", `${Math.min(index * 55, 280)}ms`);
        });

        if (userReducedMotion() || !("IntersectionObserver" in window)) {
            targets.forEach((node) => node.classList.add("is-revealed"));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("is-revealed");
                    observer.unobserve(entry.target);
                });
            },
            { rootMargin: "0px 0px -7%", threshold: 0.08 },
        );
        targets.forEach((node) => observer.observe(node));
    }

    function createSkeleton() {
        const item = document.createElement("li");
        item.className = "motion-skeleton";
        item.setAttribute("aria-hidden", "true");
        for (let index = 0; index < 4; index += 1) {
            const line = document.createElement("span");
            line.className = "motion-skeleton__line";
            item.appendChild(line);
        }
        return item;
    }

    function installLoadingSkeletons() {
        const list = document.getElementById("parking-list");
        const empty = document.getElementById("parking-empty");
        if (!list || list.children.length > 0) return;

        const fragment = document.createDocumentFragment();
        for (let index = 0; index < 3; index += 1) fragment.appendChild(createSkeleton());
        list.appendChild(fragment);

        const clearSkeletons = () => {
            list.querySelectorAll(".motion-skeleton").forEach((node) => node.remove());
        };

        const observer = new MutationObserver(() => {
            if (list.querySelector(".parking-card, .plan-b-card") || (empty && !empty.hidden)) {
                clearSkeletons();
                observer.disconnect();
            }
        });
        observer.observe(list, { childList: true, subtree: false });
        if (empty) observer.observe(empty, { attributes: true, attributeFilter: ["hidden"] });
        window.setTimeout(clearSkeletons, 12000);
    }

    function animateDynamicCards() {
        const list = document.getElementById("parking-list");
        if (!list) return;

        const animate = () => {
            list.querySelectorAll(".parking-card:not([data-motion-bound]), .plan-b-card:not([data-motion-bound])")
                .forEach((node, index) => {
                    node.dataset.motionBound = "true";
                    node.style.setProperty("--motion-index", String(index));
                    if (!userReducedMotion()) node.classList.add("motion-enter");
                    node.addEventListener("animationend", () => node.classList.remove("motion-enter"), { once: true });
                });
        };

        new MutationObserver(animate).observe(list, { childList: true });
        animate();
    }

    function animateLiveRegions() {
        document.querySelectorAll('[role="status"], [aria-live]').forEach((region) => {
            let previous = region.textContent;
            new MutationObserver(() => {
                const next = region.textContent;
                if (!next || next === previous || userReducedMotion()) return;
                previous = next;
                region.classList.remove("motion-pulse");
                void region.offsetWidth;
                region.classList.add("motion-pulse");
            }).observe(region, { childList: true, characterData: true, subtree: true });
        });
    }

    function bindMotionPreference() {
        const button = document.getElementById("motion-preference");
        if (!button) return;
        updateMotionState(userReducedMotion());
        button.addEventListener("click", () => {
            const reduced = root.dataset.reducedMotion !== "true";
            updateMotionState(reduced, { persist: true });
        });

        reducedMotionQuery.addEventListener?.("change", () => {
            if (safeStorageGet(storageKey) === null) updateMotionState(reducedMotionQuery.matches);
        });
    }

    function closeMobileMenuAfterNavigation() {
        const menu = document.querySelector(".mobile-nav");
        menu?.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => menu.removeAttribute("open"));
        });
    }

    updateMotionState(userReducedMotion());
    root.classList.add("motion-ready");
    bindMotionPreference();
    prepareRevealTargets();
    installLoadingSkeletons();
    animateDynamicCards();
    animateLiveRegions();
    closeMobileMenuAfterNavigation();
})();

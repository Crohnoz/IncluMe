(() => {
  "use strict";

  const workspace = document.getElementById("workspace");
  if (!workspace) return;

  // app-v4 binds controls by [data-view]. Remove the initial container attribute
  // before that binding so only actual buttons become interactive controls.
  workspace.removeAttribute("data-view");

  const removeInvalidPressedState = () => workspace.removeAttribute("aria-pressed");
  removeInvalidPressedState();
  new MutationObserver(removeInvalidPressedState).observe(workspace, {
    attributes: true,
    attributeFilter: ["aria-pressed"],
  });
})();

document.body.classList.add("nonav","pg-scenes");
applyTheme();applyMode();applyRotLock();
if(!openFromHash())view="active";
render();fitHeader();
if(typeof requestAnimationFrame==='function')requestAnimationFrame(fitHeader);
window.addEventListener("hashchange",()=>{if(openFromHash())render()});
claimStorage();

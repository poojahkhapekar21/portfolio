import {scenarioData, roleData, projects, toolData, projectSummaries, roleMeta, skillCategories, caseLabels} from './content.js';

const $ = id => document.getElementById(id);
const icon = name => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const sections = ['about','experience','education','skills','projects','certifications','contact'];
const names = {about:'About',experience:'Experience',education:'Education',skills:'Skills',projects:'Projects',certifications:'Certifications',contact:'Contact'};
const dialog = $('hubDialog');
const scroller = $('panelScroller');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let currentRoute = '';
let transition = 0;
let homeOpener = null;
let closeRequested = false;
let closeFallback;
const scrollPositions = new Map();
let storyScrollTop=0;
let programmaticGoal=null;
let navigationInProgress=false;
let scrollFrame=0;
let scrollIdleTimer;
let scrollGuardTimer;

// The seven sections form one reading surface. Cases are a focused detail view.
function parseRoute(value) {
  const raw=value.replace(/^#/,'');
  const [section,id,...extra]=raw.split('/');
  if(extra.length)return '';
  if(section==='projects'&&id&&projects.some(project=>project.id===id))return `projects/${id}`;
  if(id)return '';
  return sections.includes(section)?section:'';
}
function locationRoute(){try{return parseRoute(decodeURIComponent(location.hash));}catch{return '';}}
const baseURL=()=>`${location.pathname}${location.search}`;
const wait=duration=>new Promise(resolve=>setTimeout(resolve,reducedMotion.matches?0:duration));
const isCase=route=>route.includes('/');
function saveReadingPosition(){
  if(!dialog.open||!currentRoute||closeRequested)return;
  const position=scroller.scrollTop;
  scrollPositions.set(currentRoute,position);
  if(!isCase(currentRoute))storyScrollTop=position;
  history.replaceState({...history.state,scrollTop:position,viewMode:isCase(currentRoute)?'case':'story'},'',location.href);
}
function updateSectionChrome(section,caseView=false){
  $('panelTitle').textContent=caseView?'Project / Case study':names[section];
  $('panelCounter').textContent=`${String(sections.indexOf(section)+1).padStart(2,'0')} / 07`;
  $('readerHint').textContent=caseView?'CASE STUDY · RETURN TO PROJECTS':'SCROLL TO EXPLORE · ABOUT → CONTACT';
  document.querySelectorAll('[data-route]').forEach(link=>{
    if(link.dataset.route===section)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  const tab=document.querySelector('.panel-navigation [aria-current]');
  if(tab){const bar=tab.parentElement;bar.scrollLeft+=tab.getBoundingClientRect().left-bar.getBoundingClientRect().left-(bar.clientWidth-tab.offsetWidth)/2;}
}
function syncStoryScroll(){
  if(!dialog.open||!currentRoute||isCase(currentRoute)||navigationInProgress||programmaticGoal!==null||closeRequested)return;
  const top=scroller.getBoundingClientRect().top;
  const threshold=top+Math.min(120,scroller.clientHeight*.18);
  let active=sections[0];
  for(const section of sections){if($(section).getBoundingClientRect().top<=threshold)active=section;else break;}
  if(scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop<3)active='contact';
  storyScrollTop=scroller.scrollTop;
  if(active!==currentRoute){
    currentRoute=active;
    updateSectionChrome(active);
    // Passive reading replaces this entry instead of filling browser history.
    history.replaceState({...history.state,scrollTop:scroller.scrollTop,viewMode:'story'},'',`${baseURL()}#${active}`);
  }
}
function finishProgrammaticScroll(){
  clearTimeout(scrollGuardTimer);
  programmaticGoal=null;navigationInProgress=false;
  syncStoryScroll();saveReadingPosition();
}
function setScrollPosition(value,smooth=false){
  clearTimeout(scrollGuardTimer);
  programmaticGoal=Math.max(0,Math.min(value,scroller.scrollHeight-scroller.clientHeight));
  scroller.scrollTo({top:programmaticGoal,behavior:smooth&&!reducedMotion.matches?'smooth':'instant'});
  if(!smooth||reducedMotion.matches||Math.abs(scroller.scrollTop-programmaticGoal)<2){
    requestAnimationFrame(finishProgrammaticScroll);
  }else scrollGuardTimer=setTimeout(finishProgrammaticScroll,1400);
}
function navigate(route){
  if(closeRequested)return;
  const target=parseRoute(route);if(!target)return;
  if(target===currentRoute&&isCase(target))return;
  saveReadingPosition();
  if(!dialog.open)homeOpener=document.activeElement;
  if(target!==currentRoute)history.pushState({careerHub:true,depth:(history.state?.careerHub?history.state.depth:0)+1},'',`${baseURL()}#${target}`);
  applyRoute(target);
}
function finishClose(){
  clearTimeout(closeFallback);closeRequested=false;
  history.replaceState({careerHub:true,depth:0},'',baseURL());applyRoute('');
}
function closeHub(){
  if((!dialog.open&&!currentRoute)||closeRequested)return;
  saveReadingPosition();
  const depth=history.state?.careerHub?history.state.depth:0;
  if(depth>0&&history.length>1){
    closeRequested=true;history.go(-Math.min(depth,history.length-1));
    closeFallback=setTimeout(()=>{if(closeRequested)finishClose();},400);
  }else finishClose();
}
async function applyRoute(route,{restore=false}={}){
  const ticket=++transition;
  const previousRoute=currentRoute;
  const wasOpen=dialog.open;
  const wasCase=isCase(previousRoute);
  const caseView=isCase(route);
  if(previousRoute){scrollPositions.set(previousRoute,scroller.scrollTop);if(!wasCase)storyScrollTop=scroller.scrollTop;}
  navigationInProgress=true;clearTimeout(scrollGuardTimer);programmaticGoal=null;
  currentRoute=route;
  if(!route){
    dialog.classList.add('is-closing');document.body.classList.remove('panel-open');
    await wait(180);if(ticket!==transition)return;
    if(dialog.open)dialog.close();dialog.classList.remove('is-closing');
    document.querySelectorAll('[data-panel]').forEach(view=>{view.hidden=true;});
    document.querySelectorAll('.home-navigation [data-route]').forEach(link=>link.removeAttribute('aria-current'));
    navigationInProgress=false;
    (homeOpener?.isConnected&&homeOpener!==document.body?homeOpener:$('homeTitle')).focus({preventScroll:true});
    return;
  }
  if(wasOpen&&(wasCase||caseView)){scroller.classList.add('is-switching');await wait(110);}
  if(ticket!==transition)return;
  dialog.classList.remove('is-closing');
  const section=route.split('/')[0];
  if(caseView)renderCaseStudy(route.split('/')[1]);
  document.querySelectorAll('[data-panel]').forEach(view=>{
    view.hidden=caseView?view.dataset.panel!=='case-study':view.dataset.panel==='case-study';
  });
  dialog.classList.toggle('story-mode',!caseView);
  if(!dialog.open)dialog.showModal();
  document.body.classList.add('panel-open');updateSectionChrome(section,caseView);
  scroller.classList.remove('is-switching');
  const view=caseView?$('caseStudy'):$(section);
  if(!wasOpen||wasCase||caseView){view.classList.remove('is-entering');void view.offsetWidth;view.classList.add('is-entering');}
  let destination;
  if(restore&&Number.isFinite(history.state?.scrollTop))destination=history.state.scrollTop;
  else if(caseView)destination=0;
  else destination=view.offsetTop;
  const heading=view.querySelector('h2');
  if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  setScrollPosition(destination,!restore&&wasOpen&&!wasCase&&!caseView);
}
scroller.addEventListener('scroll',()=>{
  if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;syncStoryScroll();});
  clearTimeout(scrollIdleTimer);
  scrollIdleTimer=setTimeout(()=>{if(!navigationInProgress&&programmaticGoal===null)saveReadingPosition();},160);
},{passive:true});
scroller.addEventListener('scrollend',()=>{
  if(programmaticGoal!==null){if(Math.abs(scroller.scrollTop-programmaticGoal)<3)finishProgrammaticScroll();}
  else {syncStoryScroll();saveReadingPosition();}
});
function interruptScroll(){if(programmaticGoal!==null){clearTimeout(scrollGuardTimer);programmaticGoal=null;navigationInProgress=false;syncStoryScroll();}}
scroller.addEventListener('wheel',interruptScroll,{passive:true});
scroller.addEventListener('touchstart',interruptScroll,{passive:true});
scroller.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))interruptScroll();});

document.addEventListener('click', event => {
  const home = event.target.closest('[data-home]');
  if (home) { event.preventDefault(); closeHub(); return; }
  const link = event.target.closest('[data-route]');
  if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault(); navigate(link.dataset.route);
  }
});
$('closePanel').addEventListener('click',closeHub);
// Explicit boundary wrapping complements the native modal's focus containment.
dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('a[href],button:not([disabled]),summary,[tabindex="0"]')].filter(element=>element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden');
  if(!controls.length){event.preventDefault();$('closePanel').focus();return;}
  const first=controls[0],last=controls[controls.length-1],active=document.activeElement;
  if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus();}
});

dialog.addEventListener('cancel', event => { event.preventDefault(); closeHub(); });
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.querySelector('.panel-shell').getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeHub();
});
window.addEventListener('popstate',() => {if(closeRequested)finishClose();else applyRoute(locationRoute(),{restore:true});});
window.addEventListener('hashchange',() => { const route = locationRoute(); if (route !== currentRoute) applyRoute(route); });
$('backToProjects').addEventListener('click',() => {
  saveReadingPosition();
  if (history.state?.careerHub && history.state.depth > 1) history.back();
  else navigate('projects');
});

$('careerTimeline').innerHTML = Object.entries(roleMeta).map(([key,meta], index) => {
  const role=roleData[key];
  const responsibilityList=role.bulletGroups
    ? role.bulletGroups.map(group=>`<section class="responsibility-group"><h4>${group.title}</h4><ul>${group.indices.map(index=>`<li>${role.bullets[index]}</li>`).join('')}</ul></section>`).join('')
    : `<ul>${role.bullets.map(bullet=>`<li>${bullet}</li>`).join('')}</ul>`;
  const responsibilityLabel='Responsibilities & achievements';
  return `<article class="timeline-item"><span class="timeline-node" aria-hidden="true">${icon(meta.icon)}</span><div class="timeline-date">${meta.period}</div><div class="career-card stagger-card" style="--card-index:${index}"><div class="company-line"><span class="company-code" aria-hidden="true">${meta.code}</span><span>${meta.company}</span></div><h3>${meta.title}</h3><p>${role.summary}</p><div class="career-impact">${icon('delivery')}<span>${meta.impact}</span></div><div class="tag-list">${meta.tools.map(tool=>`<span>${tool}</span>`).join('')}</div><details class="career-details"><summary>${responsibilityLabel}</summary><p class="context-note">${role.date}</p>${responsibilityList}</details></div></article>`;
}).join('');

$('skillTree').innerHTML=skillCategories.map((skill,index)=>`<button class="skill-branch stagger-card" data-skill="${skill.id}" aria-pressed="false" style="--card-index:${index%4}"><span class="branch-icon">${icon(skill.icon)}</span><span class="branch-main"><strong>${skill.title}</strong><span class="branch-tools">${skill.tools.slice(0,3).join(' · ')}</span></span><span class="branch-plus" aria-hidden="true">+</span></button>`).join('');
$('toolShelf').innerHTML=Object.entries(toolData).map(([key,[name]])=>`<button class="tool-chip" data-tool="${key}" aria-pressed="false">${icon(key)}<span>${name}</span></button>`).join('');
function showSkill(title, description, glyph, tags=[]) {
  $('skillDetail').innerHTML=`<span class="detail-glyph">${icon(glyph)}</span><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(description)}</p>${tags.length?`<div class="tag-list">${tags.map(tag=>`<span>${escapeHTML(tag)}</span>`).join('')}</div>`:''}</div>`;
}
document.querySelectorAll('[data-skill],[data-tool]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-skill],[data-tool]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  if(button.dataset.skill){const skill=skillCategories.find(item=>item.id===button.dataset.skill);showSkill(skill.title,skill.description,skill.icon,skill.tools);}
  else {const [title,description]=toolData[button.dataset.tool];showSkill(title,description,button.dataset.tool);}
}));

// Project scope is limited to the titles and context supplied in the résumé.
function diagram(project) {
  const flow=project.flow;
  return `<div class="project-diagram" aria-hidden="true">${flow.map((label,index)=>`${index?'<span class="diagram-connector"></span>':''}<span class="diagram-step">${icon(index===0?'building':index===1?'api':'delivery')}<small>${escapeHTML(label)}</small></span>`).join('')}</div>`;
}
function renderProjects(filter='all') {
  const visible=projects.filter(project=>filter==='all'||project.category.includes(filter));
  $('projectGrid').innerHTML=visible.map((project,index)=>{
    const summary=projectSummaries[project.id];const [label,glyph]=caseLabels[project.id];
    return `<article class="project-card stagger-card" style="--card-index:${index%3}"><div class="project-art"><span class="project-type">${icon(glyph)} ${label}</span>${diagram(project)}</div><div class="project-body"><span class="eyebrow">${project.label}</span><h3>${summary.title}</h3><p>${summary.problem}</p><div class="project-result">${icon('requirements')}<span>${summary.value}</span></div><a class="case-link" href="#projects/${project.id}" data-route="projects/${project.id}">Explore case study</a></div></article>`;
  }).join('');
  $('projectCount').textContent=`${visible.length} ${visible.length===1?'project':'projects'}`;
  document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>renderProjects(button.dataset.filter)));
function renderCaseStudy(id) {
  const project=projects.find(item=>item.id===id);
  $('caseContent').innerHTML=`<div class="panel-heading case-heading"><p class="eyebrow">${project.label}</p><h2>${project.title}</h2><p>${project.description}</p></div>${diagram(project)}<div class="case-result"><span class="eyebrow">PROJECT FOCUS</span><p>${project.focus}</p></div><div class="case-blocks"><article><h3>Context</h3><p>${project.context}</p></article><article><h3>Related capabilities</h3><p>Connected strengths from my professional profile.</p><div class="tag-list">${project.capabilities.map(skill=>`<span>${skill}</span>`).join('')}</div></article></div><div class="case-technologies"><p class="eyebrow">PROJECT THEMES</p><div class="tag-list">${project.tags.map(tag=>`<span>${tag}</span>`).join('')}</div></div><a class="button primary project-contact" href="mailto:phkhapekar@gmail.com?subject=${encodeURIComponent('Project discussion: '+project.title)}">Discuss this project</a>`;
}

renderProjects();
function renderScenario(key) {
  const scenario=scenarioData[key];
  $('scenarioDetail').innerHTML=`<h3>${scenario.title}</h3><ol>${scenario.steps.map(step=>`<li>${step}</li>`).join('')}</ol><p>${scenario.takeaway}</p>`;
  document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenario===key)));
}
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>renderScenario(button.dataset.scenario)));
renderScenario('inventory');
$('copyIntro').addEventListener('click',async()=>{
  const text='Pooja Khapekar — supply chain operations, inventory planning, procurement, and analytics. Experience at HMM, Shivaansh Enterprise, and Epsilon. M.S. Supply Chain Management, The University of Texas at Dallas. Richardson, Texas. phkhapekar@gmail.com | https://www.linkedin.com/in/phk0621/';
  try {await navigator.clipboard.writeText(text);$('copyStatus').textContent='Introduction copied to clipboard.';}
  catch {$('copyStatus').textContent=text;const range=document.createRange();range.selectNodeContents($('copyStatus'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}
});
let paused=false;try{paused=localStorage.getItem('pooja-portfolio-motion')==='paused';}catch{}
function updateMotion() {
  const stopped=paused||reducedMotion.matches;
  document.body.classList.toggle('motion-paused',stopped);
  const control=$('motionToggle');control.hidden=false;control.disabled=reducedMotion.matches;
  control.setAttribute('aria-pressed',String(stopped));
  control.textContent=reducedMotion.matches?'Reduced motion':paused?'Resume motion':'Pause motion';
}
$('motionToggle').addEventListener('click',()=>{paused=!paused;try{localStorage.setItem('pooja-portfolio-motion',paused?'paused':'running');}catch{}updateMotion();});
reducedMotion.addEventListener('change',updateMotion);
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('page-hidden',document.hidden));
updateMotion();
document.body.classList.add('app-ready');
const initial=locationRoute();
history.replaceState({careerHub:true,depth:0},'',baseURL());
if(initial)navigate(initial);

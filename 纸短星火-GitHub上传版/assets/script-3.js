(function(){
 'use strict';
 var available=false,states={},people=window.LETTER_PEOPLE;
 var $=function(s,r){return(r||document).querySelector(s);};
 function add(parent,tag,text,cls){var e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;parent.appendChild(e);return e;}
 function suggestions(d,mode){
  var choices=d.questions.map(function(x){return x.q;});
  if(available)choices=choices.concat(mode==='narrator'?
   ['这封信写在怎样的历史背景下？','这位人物有哪些有材料记载的事迹？','从这封家书，可以看出哪些性格特点？','这位人物的经历与信中的选择有什么联系？']:
   ['你在信中最想让我理解什么？','这段文字与你当时的处境有什么联系？','你在写信以前，有哪些可以和我谈的经历？','信中哪句话最能体现你对家人的牵挂？']);
  for(var i=choices.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=choices[i];choices[i]=choices[j];choices[j]=t;}
  return choices.slice(0,4);
 }
 function renderQuestions(d,qs){
  var st=states[d.id],box=st.controls.querySelector('.ai-suggestions');box.replaceChildren();
  qs.forEach(function(q){var b=add(box,'button',q,'chip');b.type='button';b.onclick=function(){if(st.busy)return;if(available)send(d,q);else{var input=$('input',st.chat);input.value=q;$('form',st.chat).requestSubmit();}};});
 }
 function msg(d,text,user,kind,sources,mode){
  var st=states[d.id],box=$('.msgs',st.chat),m=add(box,'div','','msg '+(user?'user':'bot'));
  var label=user?(mode==='narrator'?'你 · 历史读者':'你 · '+d.role):(mode==='narrator'?'AI历史讲述者':'AI '+d.name+' · 角色演绎');
  add(m,'span',label,'family-speaker');
  if(kind==='interpretation')add(m,'span','基于材料的解读','ai-kind');
  if(kind==='boundary')add(m,'span','资料边界','ai-kind');
  add(m,'div',text);
  if(sources&&sources.length){var details=add(m,'details','','family-evidence');add(details,'summary','史料依据与出处');sources.forEach(function(s){add(details,'p',s.label+'：'+s.text);var a=add(details,'a','查看来源');if(/^https:\/\//.test(s.url)){a.href=s.url;a.target='_blank';a.rel='noopener';}});}
  box.scrollTop=box.scrollHeight;return m;
 }
 async function send(d,text){
  var st=states[d.id];text=text.trim();if(!text||st.busy)return;
  var mode=st.mode.value;st.busy=true;st.mode.disabled=true;
  st.random.disabled=true;$('form button',st.chat).disabled=true;
  msg(d,text,true,null,null,mode);$('input',st.chat).value='';
  var box=$('.msgs',st.chat),pending=add(box,'div','正在查阅相关史料……','typing');box.scrollTop=box.scrollHeight;
  try{
   var selected=Number($('.family-text p.selected',$('#view-'+d.id))?.dataset.paragraph??-1);
   var r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person:d.id,mode:mode,question:text,selected:selected,history:st.history[mode].slice(-8)}),signal:AbortSignal.timeout(35000)});
   var result=await r.json();if(!r.ok)throw Error(result.message||'AI暂时不可用');
   if(!result.generated||typeof result.reply!=='string')throw Error('AI未返回有效回答');
   msg(d,result.reply,false,result.kind,result.sources,mode);
   st.history[mode].push({role:'user',content:text},{role:'assistant',content:result.reply});st.history[mode]=st.history[mode].slice(-8);
   if(result.followups?.length)renderQuestions(d,result.followups);else renderQuestions(d,suggestions(d,mode));
   st.status.textContent=mode==='narrator'?'AI历史讲述 · 请结合史料阅读':'AI人物对话 · 回答为角色演绎';
  }catch(e){
   var error=add(box,'div','本次AI回答未生成。'+(e.name==='TimeoutError'?'等待超时，请重试。':e.message),'ai-error');
   var retry=add(error,'button','重新提问');retry.type='button';retry.onclick=function(){send(d,text);};
  }finally{pending.remove();st.busy=false;st.mode.disabled=!available;st.random.disabled=false;$('form button',st.chat).disabled=false;box.scrollTop=box.scrollHeight;}
 }
 people.forEach(function(d){
  var chat=$('#view-'+d.id+'-dialogue'),controls=document.createElement('div');controls.className='ai-controls';
  var status=add(controls,'p','史料问答 · 正在检查AI连接','ai-status');status.setAttribute('aria-live','polite');
  var label=add(controls,'label','对话视角 '),mode=add(label,'select','');mode.setAttribute('aria-label','选择对话视角');
  [['role','与写信人对话'],['narrator','听历史讲述者解读']].forEach(function(x){var o=add(mode,'option',x[1]);o.value=x[0];});mode.disabled=true;
  var random=add(controls,'button','随机聊一个话题');random.type='button';
  var refresh=add(controls,'button','换一组问题');refresh.type='button';
  var clear=add(controls,'button','清空本人物对话');clear.type='button';
  var options=add(controls,'div','','ai-suggestions presets');
  add(controls,'p','AI接通后，仅发送当前人物最近4轮对话和所选原文。请勿填写个人隐私；本网站不保存聊天内容。','ai-privacy');
  chat.insertBefore(controls,$('.family-chat',chat));
  var st=states[d.id]={controls:controls,chat:chat,status:status,mode:mode,random:random,busy:false,history:{role:[],narrator:[]}};
  renderQuestions(d,suggestions(d,'role'));
  refresh.onclick=function(){if(!st.busy)renderQuestions(d,suggestions(d,mode.value));};
  random.onclick=function(){if(!st.busy){var q=suggestions(d,mode.value)[0];if(available)send(d,q);else{var input=$('input',chat);input.value=q;$('form',chat).requestSubmit();}};};
  mode.onchange=function(){renderQuestions(d,suggestions(d,mode.value));status.textContent=mode.value==='narrator'?'AI历史讲述 · 第三人称解读完整经历':'AI人物对话 · 时间限定在写信时';var spans=st.chat.querySelectorAll('.family-role span');spans[0].textContent=mode.value==='narrator'?'你 · 历史读者':'你：'+d.role;spans[1].textContent=mode.value==='narrator'?'对方：AI历史讲述者':'对方：'+d.name+' · 角色演绎';};
  clear.onclick=function(){if(st.busy)return;st.history={role:[],narrator:[]};$('.msgs',chat).replaceChildren();if(available)msg(d,mode.value==='narrator'?'我会依据已收录资料，讲解'+d.name+'的时代背景、事迹与文字。你想从哪里开始？':d.opening,false,null,null,mode.value);else add($('.msgs',chat),'div',d.opening,'msg bot');};
 });
 window.LetterAI={isAvailable:function(){return available;},send:send};
 if(false)fetch('/api/chat/status',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error();return r.json();}).then(function(x){available=x.available===true;Object.values(states).forEach(function(st){st.status.textContent=available?'AI已连接 · 可自由提问和连续追问':'经典互动 · HTML离线版';st.mode.disabled=!available;st.chat.classList.toggle('ai-ready',available);});if(available)people.forEach(function(d){renderQuestions(d,suggestions(d,'role'));});}).catch(function(){Object.values(states).forEach(function(st){st.status.textContent='经典互动 · HTML离线版';});});
 else Object.values(states).forEach(function(st){st.status.textContent='本地史料问答 · AI需通过服务器启动';});
})();

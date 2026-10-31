/* Seleção Fluiar — comportamentos visuais compartilhados (protótipo, sem lógica de negócio)
   - Ícones (sprite SVG)            - Menu lateral / gaveta mobile   - Avisos (toast)
   - Modal de confirmação de exclusão  - Validação visual de formulários
   - Busca em tabelas               - Estados por hash (#vazio, #editar, #enviado)
   - Navegador de telas do protótipo */
(function(){
  'use strict';
  var ICONS={
    grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    users:'<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.3c1.6.6 2.7 2.2 3 4.7"/>',
    list:'<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 6.2l1 1 1.8-2M4 11.7l1 1 1.8-2"/><circle cx="5" cy="17.5" r="1.1"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    out:'<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeoff:'<path d="M4 4l16 16M10.6 6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.6 3.4M6.6 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    edit:'<path d="M14.5 5.5l4 4M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19 4 20z"/>',
    trash:'<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/>',
    back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h10"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    mail:'<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    phone:'<path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
    image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>',
    bag:'<path d="M5.5 8h13l-1 11.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5.5 8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
    alert:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.2v.1"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    layers:'<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8 12 3.5z"/><path d="M3.5 12L12 16.5 20.5 12M3.5 16L12 20.5 20.5 16"/>',
    send:'<path d="M20.5 3.5L10 14M20.5 3.5l-6.5 17-4-6.5-6.5-4 17-6.5z"/>'
  };
  var sprite='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'+Object.keys(ICONS).map(function(k){
    return '<symbol id="i-'+k+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+ICONS[k]+'</symbol>';
  }).join('')+'</defs></svg>';
  document.body.insertAdjacentHTML('afterbegin',sprite);
  var ic=function(n){return '<svg class="ic" aria-hidden="true"><use href="#i-'+n+'"/></svg>'};
  window.FluiarIcon=ic;

  /* ---------- Menu principal ---------- */
  var NAV=[
    ['dashboard','dashboard.html','Dashboard','grid'],
    ['clientes','clientes.html','Clientes','users'],
    ['listas','listas.html','Listas de compras','list'],
    ['config','configuracoes.html','Configurações','gear']
  ];
  var cur=document.body.getAttribute('data-nav');
  if(cur!==null){
    document.body.classList.add('shell');
    var links=NAV.map(function(n){return '<a href="'+n[1]+'"'+(n[0]===cur?' aria-current="page"':'')+'>'+ic(n[3])+n[2]+'</a>'}).join('');
    var shell='<a class="skip" href="#main">Pular para o conteúdo</a>'
      +'<header class="topbar"><a class="logo" href="dashboard.html">FLUIAR</a><button class="iconbtn" id="menu-open" aria-label="Abrir menu" aria-controls="side" aria-expanded="false">'+ic('menu')+'</button></header>'
      +'<aside class="side" id="side" aria-label="Menu principal"><button class="iconbtn close" id="menu-close" aria-label="Fechar menu">'+ic('x')+'</button>'
      +'<a class="logo" href="dashboard.html">FLUIAR<small>Seleção</small></a>'
      +'<nav class="nav">'+links+'</nav>'
      +'<div class="me"><div class="me-card"><span class="avatar">PH</span><div><b>Paula Hooper</b><span>Arquiteta · Fluiar</span></div></div>'
      +'<nav class="nav"><a class="out" href="login.html" data-flash="Você saiu da sua conta.">'+ic('out')+'Sair</a></nav></div></aside>'
      +'<div class="scrim" id="scrim"></div>';
    document.body.insertAdjacentHTML('afterbegin',shell);
    var side=document.getElementById('side'),scrim=document.getElementById('scrim'),ob=document.getElementById('menu-open');
    var setMenu=function(open){side.classList.toggle('open',open);scrim.classList.toggle('open',open);ob.setAttribute('aria-expanded',open);if(open)side.querySelector('.nav a').focus()};
    ob.addEventListener('click',function(){setMenu(true)});
    document.getElementById('menu-close').addEventListener('click',function(){setMenu(false);ob.focus()});
    scrim.addEventListener('click',function(){setMenu(false)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&side.classList.contains('open')){setMenu(false);ob.focus()}});
  }

  /* ---------- Avisos ---------- */
  var tbox=document.createElement('div');tbox.className='toasts';tbox.setAttribute('role','status');tbox.setAttribute('aria-live','polite');document.body.appendChild(tbox);
  function toast(msg,type){
    var t=document.createElement('div');t.className='toast'+(type==='err'?' err':'');
    t.innerHTML=ic(type==='err'?'alert':'check')+'<span></span>';t.querySelector('span').textContent=msg;
    tbox.appendChild(t);
    setTimeout(function(){t.classList.add('out');setTimeout(function(){t.remove()},320)},2600);
  }
  window.toast=toast;
  // aviso trazido de outra tela (ex.: "Cliente salvo")
  try{var f=sessionStorage.getItem('flash');if(f){sessionStorage.removeItem('flash');var p=JSON.parse(f);setTimeout(function(){toast(p.m,p.t)},250)}}catch(e){}
  function go(url,msg,type){try{if(msg)sessionStorage.setItem('flash',JSON.stringify({m:msg,t:type}))}catch(e){}location.href=url}
  window.goWithToast=go;
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[data-flash]');if(!a)return;e.preventDefault();go(a.getAttribute('href'),a.getAttribute('data-flash'));
  });

  /* ---------- Modal de confirmação ---------- */
  var modal=document.createElement('div');modal.className='modal';modal.hidden=true;
  modal.innerHTML='<div class="scrimm" data-close></div><div class="box" role="alertdialog" aria-modal="true" aria-labelledby="m-t" aria-describedby="m-d"><span class="art">'+ic('trash')+'</span><h2 id="m-t"></h2><p id="m-d"></p><div class="btns"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" id="m-ok"></button></div></div>';
  document.body.appendChild(modal);
  var pending=null,lastFocus=null;
  function ask(o){
    pending=o.onOk;lastFocus=document.activeElement;
    modal.querySelector('#m-t').textContent=o.title;
    modal.querySelector('#m-d').textContent=o.text||'Essa ação não pode ser desfeita.';
    modal.querySelector('#m-ok').textContent=o.ok||'Excluir';
    modal.hidden=false;modal.querySelector('[data-close].btn').focus();
  }
  function close(){modal.hidden=true;pending=null;if(lastFocus)lastFocus.focus()}
  window.askConfirm=ask;
  modal.addEventListener('click',function(e){if(e.target.closest('[data-close]'))close();if(e.target.id==='m-ok'){var fn=pending;close();if(fn)fn()}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close()});
  // Botões com data-confirm="Título"
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-confirm]');if(!b)return;e.preventDefault();
    ask({title:b.getAttribute('data-confirm'),text:b.getAttribute('data-confirm-text'),ok:b.getAttribute('data-confirm-ok'),onOk:function(){
      var next=b.getAttribute('data-next'),msg=b.getAttribute('data-done')||'Excluído.';
      if(next){go(next,msg);return}
      var row=b.closest(b.getAttribute('data-remove')||'tr');
      if(row){row.classList.add('removing');row.style.transition='opacity .3s';row.style.opacity='0';setTimeout(function(){row.remove();document.dispatchEvent(new CustomEvent('rowremoved'))},300)}
      toast(msg);
    }});
  });

  /* ---------- Mostrar/ocultar senha e força ---------- */
  document.addEventListener('click',function(e){
    var b=e.target.closest('.pw');if(!b)return;
    var inp=b.parentNode.querySelector('input');var show=inp.type==='password';inp.type=show?'text':'password';
    b.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');b.innerHTML=ic(show?'eyeoff':'eye');
  });
  document.querySelectorAll('.pw').forEach(function(b){b.innerHTML=ic('eye');b.setAttribute('aria-label','Mostrar senha');b.type='button';b.classList.add('iconbtn')});
  document.addEventListener('input',function(e){
    var m=e.target.getAttribute&&e.target.getAttribute('data-strength');if(!m)return;
    var v=e.target.value,s=0;if(v.length>=8)s++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))s++;if(/\d|[^\w]/.test(v)&&v.length>=10)s++;
    var el=document.getElementById(m);el.setAttribute('data-l',v?Math.max(1,s):0);
    var lbl=document.getElementById(m+'-t');if(lbl)lbl.textContent=v?['Senha fraca','Senha fraca','Senha razoável','Senha forte'][s]:'Use pelo menos 8 caracteres, com letras e números.';
  });

  /* ---------- Validação visual de formulários ---------- */
  function setErr(input,msg){
    var f=input.closest('.field');if(!f)return;
    var old=f.querySelector('.errmsg');if(old)old.remove();
    f.classList.toggle('invalid',!!msg);input.setAttribute('aria-invalid',msg?'true':'false');
    if(msg){var p=document.createElement('p');p.className='errmsg';p.id=input.id+'-err';p.style.margin='0';p.textContent=msg;f.appendChild(p);input.setAttribute('aria-describedby',p.id)}
  }
  function check(input){
    var v=input.value.trim();
    if(input.required&&!v)return input.getAttribute('data-msg')||'Preencha este campo.';
    if(v&&input.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return 'Digite um e-mail válido, como nome@email.com.';
    if(v&&input.minLength>0&&v.length<input.minLength)return 'Use pelo menos '+input.minLength+' caracteres.';
    if(v&&input.type==='url'&&!/^https?:\/\/\S+\.\S+/.test(v))return 'Cole o link completo, começando com https://';
    var ri=input.getAttribute('data-required-if');if(ri&&!v&&document.getElementById(ri).value)return 'Informe a senha atual para trocar a senha.';
    var m=input.getAttribute('data-match');if(m&&v!==document.getElementById(m).value)return 'As senhas não são iguais.';
    return '';
  }
  document.addEventListener('blur',function(e){
    var i=e.target;if(!i.closest||!i.closest('form[data-demo]')||!i.matches('input,select,textarea'))return;
    if(i.closest('.field.invalid')||(i.value&&i.type!=='password'))setErr(i,check(i));
  },true);
  document.addEventListener('submit',function(e){
    var form=e.target;if(!form.matches('form[data-demo]'))return;e.preventDefault();
    var first=null;
    form.querySelectorAll('input,select,textarea').forEach(function(i){if(i.type==='file'||i.type==='radio'||i.type==='checkbox')return;var m=check(i);setErr(i,m);if(m&&!first)first=i});
    var banner=form.querySelector('.alert-err[data-banner]');if(banner)banner.hidden=true;
    if(first){first.focus();toast('Revise os campos destacados.','err');return}
    // Erro simulado (ex.: login com senha "erro")
    var fail=form.getAttribute('data-fail-if');
    if(fail){var parts=fail.split('=');var fi=document.getElementById(parts[0]);if(fi&&fi.value===parts[1]){if(banner){banner.hidden=false;banner.focus()}return}}
    var btn=form.querySelector('button[type=submit]');if(btn){btn.setAttribute('aria-busy','true');btn.dataset.l=btn.innerHTML;btn.textContent=btn.getAttribute('data-busy')||'Salvando…'}
    setTimeout(function(){
      if(btn){btn.removeAttribute('aria-busy');btn.innerHTML=btn.dataset.l}
      var step=form.getAttribute('data-step-to');if(step){location.hash=step;return}
      var next=form.getAttribute('data-next'),msg=form.getAttribute('data-success');
      if(next)go(next,msg);else if(msg)toast(msg);
    },650);
  });

  /* ---------- Busca em tabela ---------- */
  document.querySelectorAll('[data-filter]').forEach(function(inp){
    var body=document.querySelector(inp.getAttribute('data-filter'));
    var none=document.querySelector(inp.getAttribute('data-noresults'));
    var run=function(){
      var q=inp.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''),n=0;
      body.querySelectorAll('[data-name]').forEach(function(r){
        var hit=r.getAttribute('data-name').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').indexOf(q)>-1;r.hidden=!hit;if(hit)n++;
      });
      if(none){none.hidden=n>0;var s=none.querySelector('[data-q]');if(s)s.textContent=inp.value.trim()}
      var c=document.querySelector(inp.getAttribute('data-count'));if(c)c.textContent=n;
    };
    inp.addEventListener('input',run);
    document.addEventListener('rowremoved',run);
  });

  /* ---------- Estados por hash: #vazio, #editar, #enviado... ---------- */
  function applyHash(){
    var h=location.hash.replace('#','');
    document.querySelectorAll('[data-when]').forEach(function(el){
      var w=el.getAttribute('data-when').split(' ');
      var neg=w.filter(function(x){return x.charAt(0)==='!'}).map(function(x){return x.slice(1)});
      var pos=w.filter(function(x){return x.charAt(0)!=='!'});
      el.hidden=pos.length?pos.indexOf(h)<0:neg.indexOf(h)>-1;
    });
    if(h==='editar')document.querySelectorAll('[data-edit-value]').forEach(function(i){if(!i.dataset.filled){i.value=i.getAttribute('data-edit-value');i.dataset.filled=1;i.dispatchEvent(new Event('input',{bubbles:true}))}});
    if(h==='editar')document.querySelectorAll('[data-edit-check]').forEach(function(i){i.checked=true});
    document.dispatchEvent(new CustomEvent('statechange',{detail:h}));
  }
  applyHash();window.addEventListener('hashchange',applyHash);

  /* ---------- Máscara de telefone ---------- */
  document.addEventListener('input',function(e){
    if(!e.target.matches||!e.target.matches('[data-mask=tel]'))return;
    var d=e.target.value.replace(/\D/g,'').slice(0,11),o=d;
    if(d.length>2)o='('+d.slice(0,2)+') '+d.slice(2);
    if(d.length>7)o='('+d.slice(0,2)+') '+d.slice(2,d.length-4)+'-'+d.slice(-4);
    e.target.value=o;
  });

  /* ---------- Navegador de telas do protótipo ---------- */
  var SCREENS=[
    ['Acesso',[['login.html','Login'],['login.html#erro','Login','com erro'],['cadastro.html','Cadastro de usuário'],['recuperar-senha.html','Recuperar senha'],['recuperar-senha.html#enviado','Recuperar senha','enviado'],['nova-senha.html','Nova senha']]],
    ['Sistema',[['dashboard.html','Dashboard'],['clientes.html','Clientes'],['cliente-form.html','Novo cliente'],['cliente-form.html#editar','Editar cliente'],['cliente.html','Detalhes do cliente'],['listas.html','Listas de compras'],['lista-form.html','Nova lista'],['lista-form.html#editar','Editar lista'],['lista.html','Lista de compras'],['produto-form.html','Novo produto'],['produto-form.html#editar','Editar produto'],['configuracoes.html','Configurações']]],
    ['Estados vazios',[['dashboard.html#vazio','Dashboard','vazio'],['clientes.html#vazio','Clientes','vazio'],['cliente.html#vazio','Cliente sem listas','vazio'],['listas.html#vazio','Listas','vazio'],['lista.html#vazio','Lista sem produtos','vazio']]]
  ];
  var here=(location.pathname.split('/').pop()||'')+location.hash;
  var pw=document.createElement('div');pw.className='proto';
  pw.innerHTML='<div class="panel" id="proto-panel" hidden><a href="./">← Mapa de telas</a>'+SCREENS.map(function(g){
    return '<b>'+g[0]+'</b>'+g[1].map(function(s){return '<a href="'+s[0]+'"'+(s[0]===here?' class="cur"':'')+'>'+s[1]+(s[2]?' <small>'+s[2]+'</small>':'')+'</a>'}).join('');
  }).join('')+'</div><button type="button" aria-expanded="false" aria-controls="proto-panel">'+ic('layers')+'Telas</button>';
  document.body.appendChild(pw);
  var pb=pw.querySelector('button'),pp=pw.querySelector('.panel');
  pb.addEventListener('click',function(){pp.hidden=!pp.hidden;pb.setAttribute('aria-expanded',!pp.hidden)});
  document.addEventListener('click',function(e){if(!pw.contains(e.target)){pp.hidden=true;pb.setAttribute('aria-expanded','false')}});
  // links do mesmo arquivo com hash diferente: forçar atualização de estado
  pp.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var p=a.getAttribute('href').split('#');if(p[0]===location.pathname.split('/').pop()){e.preventDefault();location.hash=p[1]||'';if(!p[1])history.replaceState(null,'',location.pathname);applyHash();pp.hidden=true}});
})();

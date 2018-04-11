const pm = ('close die focus insert open processAutocompleteReply prompt saved setTC stateChanged' +
  ' zoom ReplyFormatCode SetHighlightLine ValueTip').split(' ');
D.IPC_Client = function IPCClient(winId) {
  // start IPC client
  D.ipc.config.id = `editor${winId}`;
  D.ipc.config.retry = 1500;
  D.ipc.config.silent = true;
  D.send = (type, payload) => D.ipc.of.ride_master.emit('RIDE', [type, payload]);
  D.ipc.connectTo('ride_master', () => {
    const rm = D.ipc.of.ride_master;
    const ide = new D.IDE({ floating: 1, ipc: rm });
    rm.on('connect', () => {
      D.ipc.log('## connected to ride_master ##'.rainbow, D.ipc.config.delay);
      rm.emit('browserCreated', winId);
      window.onbeforeunload = (e) => { ide.onbeforeunload(e); };
    });
    rm.on('disconnect', () => {
      D.ipc.log('disconnected from ride_master'.notice);
      D.ide.connected = 0;
      window.close();
    });
    pm.forEach(k => rm.on(k, ([id, ...x]) => { D.ide.wins[id][k](...x); }));
    rm.on('getUnsaved', () => {
      rm.emit('getUnsavedReply', D.ide.getUnsaved());
    });
    rm.on('prf', ([k, x]) => { D.prf[k](x, 1); });
    rm.on('ED', id => D.ide.wins[id].ED(D.ide.wins[id].me));
    rm.on('pendingEditor', (pe) => {
      D.ipc.log('got pendingEditor from ride_master : '.debug);
      const { editorOpts, ee } = pe;
      const ed = new D.Ed(D.ide, editorOpts);
      D.ide.wins[ed.id] = ed;
      ed.me_ready.then(() => {
        ed.open(ee); ed.updSize(); document.title = ed.name;
        ed.refresh();
        rm.emit('unblock', ed.id);
      });
      setTimeout(() => {
        const glr = D.ide.gl.root;
        const ci = glr.contentItems;
        if (!ci.length) glr.addChild({ type: 'stack' });
        ci[0].type === 'stack' && ci[0].header.position(ci[0].contentItems.length ? 'top' : false);
        glr.contentItems[0].addChild({
          type: 'component',
          componentName: 'win',
          componentState: { id: ed.id },
          title: ee.name,
        });
      }, 100);
    });
  });
};

D.IPC_Prf = function IPCPrf() {
  // start IPC client - preferences
  D.ipc.config.id = 'prf';
  D.ipc.config.retry = 1500;
  D.ipc.config.silent = true;
  D.ipc.connectTo('ride_master', () => {
    const rm = D.ipc.of.ride_master;
    rm.on('connect', () => {
      D.ipc.log('## connected to ride_master ##'.rainbow, D.ipc.config.delay);
      window.onbeforeunload = (e) => {
        e.returnValue = false;
        rm.emit('prfClose');
      };
      rm.emit('prfCreated');
    });
    rm.on('disconnect', () => {
      D.ipc.log('disconnected from ride_master'.notice);
      D.onbeforeunload = null;
      window.close();
    });
    rm.on('show', () => D.prf_ui());
    rm.on('prf', ([k, x]) => D.prf[k](x, 1));
  });
};

D.IPC_Server = function IPCServer() {
  // start IPC server
  D.pwins = [];
  D.pendingEditors = [];
  D.ipc.config.id = 'ride_master';
  D.ipc.config.retry = 1500;
  D.ipc.config.silent = true;
  D.ipc.serve(() => {
    const srv = D.ipc.server;
    srv.on('prfCreated', (data, socket) => { D.prf_bw.socket = socket; });
    srv.on('prfShow', () => D.prf_ui());
    srv.on('prfClose', () => {
      D.el.BrowserWindow.fromId(D.prf_bw.id).hide();
      D.ide && D.ide.focusMRUWin();
    });
    srv.on('browserCreated', (bwId, socket) => {
      const wp = new D.IPC_WindowProxy(bwId, socket);
      D.pwins.push(wp);
      D.IPC_LinkEditor();
    });
    srv.on('Edit', data => D.ide.Edit(data));
    srv.on('focusedWin', (id) => {
      const w = D.ide.wins[id];
      D.ide.focusedWin = w;
      w && (w.focusTS = +new Date());
    });
    srv.on('getSIS', () => D.ide.getSIS());
    srv.on('getUnsavedReply', (data) => {
      if (!D.pendingEdit) return;
      Object.keys(data).forEach((k) => {
        if (data[k] && D.pendingEdit.unsaved[k] === -1) D.pendingEdit.unsaved[k] = data[k];
        else delete D.pendingEdit.unsaved[k];
      });
      let ready = true;
      Object.keys(D.pendingEdit.unsaved).forEach((k) => {
        ready = ready && D.pendingEdit.unsaved[k];
      });
      if (ready) {
        D.send('Edit', D.pendingEdit);
        delete D.pendingEdit;
      }
    });
    srv.on('prf', ([k, x]) => { D.prf[k](x); });
    srv.on('switchWin', data => D.ide.switchWin(data));
    srv.on('updPW', data => D.ide.updPW(data));
    srv.on('unblock', () => D.ide.unblock());
    srv.on('mounted', (id) => {
      D.ide.hadErr > 0 && (D.ide.hadErr -= 1);
      D.ide.focusWin(D.ide.wins[id]);
    });
    srv.on('zoom', z => D.ide.zoom(z));
    srv.on('RIDE', ([type, payload]) => D.send(type, payload));
  });
  D.ipc.server.start();
  D.prf.floatOnTop((x) => {
    Object.keys(D.pwins).forEach((k) => {
      D.el.BrowserWindow.fromId(D.pwins[k].bwId).setAlwaysOnTop(!!x);
    });
  });
};
function WindowRect(id, prf) {
  let {
    x, y, width, height,
  } = prf;
  x += prf.ox * (id - 1);
  y += prf.oy * (id - 1);
  const b = D.el.screen.getDisplayMatching({
    x, y, width, height,
  }).bounds;
  const vw = Math.max(0, Math.min(x + width, b.x + b.width) - Math.max(x, b.x));
  const vh = Math.max(0, Math.min(y + height, b.y + b.height) - Math.max(y, b.y));
  if (width * height > 2 * vw * vh) {
    // saved window position is now mostly off screen
    x = null; y = null;
    width = Math.min(width, b.width);
    height = Math.min(height, b.height);
  }
  return {
    x, y, width, height,
  };
}
D.IPC_LinkEditor = function IPCLinkEditor(pe) {
  pe && D.pendingEditors.push(pe);
  if (!D.pendingEditors.length) return;
  let wp = D.prf.floatSingle() ? D.pwins[0] : D.pwins.find(w => w.id < 0);
  if (!wp) {
    let opts = {
      icon: `${__dirname}/D.png`,
      show: false,
      fullscreen: false,
      fullscreenable: true,
      alwaysOnTop: !!D.prf.floatOnTop(),
    };
    opts = Object.assign(opts, WindowRect(pe.editorOpts.id, D.prf.editWins()));
    const bw = new D.el.BrowserWindow(opts);
    bw.loadURL(`${window.location}?${bw.id}`);
    return;
  } else if (wp.id > 0) {
    wp = Object.assign(new D.IPC_WindowProxy(), wp);
  }
  D.el.BrowserWindow.fromId(wp.bwId).show();
  const ped = D.pendingEditors.shift();
  wp.id = ped.editorOpts.id;
  wp.tc = ped.editorOpts.tc;
  D.wins[wp.id] = wp;
  D.ipc.server.emit(wp.socket, 'pendingEditor', ped);
};

D.IPC_WindowProxy = function IPCWindowProxy(bwId, socket) {
  const ed = this;
  ed.bwId = bwId;
  ed.socket = socket;
  ed.id = -1;
  ed.me = { dyalogCmds: ed };
  ed.tc = 0;
  ed.focusTS = +new Date();
};
D.IPC_WindowProxy.prototype = {
  emit(f, ...x) { D.ipc.server.emit(this.socket, f, [this.id, ...x]); },
  hasFocus() { return this === D.ide.focusedWin; },
  close(x) {
    if (this === D.pwins[0] && D.prf.editWinsRememberPos()) {
      const b = D.el.BrowserWindow.fromId(this.bwId).getBounds();
      D.prf.editWins(Object.assign(D.prf.editWins(), b));
    }
    this.emit('close', x);
  },
  setTC(x) { this.emit('setTC', x); this.tc = x; },
  ED() { this.emit('ED'); },
  LN() { D.prf.lineNums.toggle(); },
  TVO() { D.prf.fold.toggle(); },
  TVB() { D.prf.breakPts.toggle(); },
};
function handlerFor(k) {
  return function handler(...x) { this.emit(k, ...x); };
}
pm.forEach((k) => {
  D.IPC_WindowProxy.prototype[k] || (D.IPC_WindowProxy.prototype[k] = handlerFor(k));
});

var connect=require('./connect'),
    Editor=require('./editor').Editor,
    IDE=require('./ide').IDE,
    prefs=require('./prefs')
require('./prefs-colours') // load it in order to initialise syntax highlighting
require('./demo')
require('./cm-foldgutter')

$(function(){
  CodeMirror.defaults.dragDrop=false
  window.ondragover=window.ondrop=function(e){e.preventDefault();return false}

  // don't use Alt- keystrokes on the Mac (see email from 2015-09-01)
  var h=CodeMirror.keyMap.emacsy;for(var k in h)if(/^alt-[a-z]$/i.test(k))delete h[k]

  if(D.nwjs){
    var zM=11 // zoom level can be from -zM to zM inclusive
    function ZMI(){prefs.zoom(Math.min( zM,prefs.zoom()+1))}
    function ZMO(){prefs.zoom(Math.max(-zM,prefs.zoom()-1))}
    function ZMR(){prefs.zoom(0)}
    $.extend(CodeMirror.commands,{ZMI:ZMI,ZMO:ZMO,ZMR:ZMR})
    $(document).bind('mousewheel',function(e){
      var d=e.originalEvent.wheelDelta;d&&e.ctrlKey&&!e.shiftKey&&!e.altKey&&(d>0?ZMI:ZMO)()
    })
    $('body').addClass('zoom'+prefs.zoom())
    prefs.zoom(function(z){
      for (var x in D.wins){
        var $b=$('body',D.wins[x].getDocument())
        $b.prop('class','zoom'+z+' '+$b.prop('class').split(/\s+/).filter(function(s){return!/^zoom-?\d+$/.test(s)}).join(' '))
        D.wins[x].refresh()
      }
      D.wins[0].scrollCursorIntoView()
    })
  }
  if(!D.open)
    D.open=function(url,o){
      var x=o.x,y=o.y,width=o.width,height=o.height,spec='resizable=1'
      if(width!=null&&height!=null)spec+=',width='+width+',height='+height
      if(x!=null&&y!=null)spec+=',left='+x+',top='+y+',screenX='+x+',screenY='+y
      return!!open(url,'_blank',spec)
    }
  D.openExternal||(D.openExternal=function(x){open(x,'_blank')})
  D.setTitle||(D.setTitle=function(s){document.title=s})
  var urlParams={},ref=(location+'').replace(/^[^\?]*($|\?)/,'').split('&')
  for(var i=0;i<ref.length;i++){var m=/^([^=]*)=?(.*)$/.exec(ref[i]);urlParams[unescape(m[1]||'')]=unescape(m[2]||'')}
  var win=urlParams.win
  if(D.floating&&win){
    $('body').addClass('floating-window').html('<div class=ui-layout-center></div>').layout({
      fxName:'',defaults:{enableCursorHotkey:0},center:{onresize:function(){ed&&ed.updateSize()}}
    })
    var ref2=opener.D.pendingEditors[win], editorOpts=ref2.editorOpts, ee=ref2.ee, ide=ref2.ide
    D.wins=opener.D.wins
    var ed=opener.D.wins[win]=new Editor(ide,$('.ui-layout-center'),editorOpts)
    ed.open(ee)
    ed.updateSize()
    D.setTitle(ed.name)
    window.onbeforeunload=function(){return ed.onbeforeunload()}
    setTimeout(function(){ed.refresh()},500) // work around a rendering issue on Ubuntu
    opener.D.ide.unblock()
  }else{
    D.socket=(D.createSocket||function(){return eio((location.protocol==='https:'?'wss://':'ws://')+location.host)})()
    if(!D.quit)D.quit=close
    var o=D.opts||{} // process command line arguments
    if(o.listen)connect().listen(o._[0])
    else if(o.connect)connect().connect(o._[0])
    else if(o.spawn){
      var ide=new IDE;D.socket.emit('*spawn') // '*spawnedError' is handled in ide.coffee
      window.onbeforeunload=function(){D.socket.emit('Exit',{code:0})}
    }
    else connect()
  }

  if(!prefs.theme()){
    prefs.theme(D.mac||/^(darwin|mac|ipad|iphone|ipod)/i.test(navigator?navigator.platform:'')?'cupertino':
                D.win||/^win/.test(navigator?navigator.platform:'')?'redmond':'classic')
  }
  $('body').addClass('theme-'+prefs.theme())
  prefs.theme(function(x,old){$('body').removeClass('theme-'+old).addClass('theme-'+x);D.ide&&D.ide.layout.resizeAll()})

  D.nwjs&&$('body').addClass(D.mac?'platform-mac':D.win?'platform-windows':'')

  $(window).on('focus blur',function(e){$('body').toggleClass('window-focused',window.focused=e.type==='focus')})
  window.focused=true

  // Some library is doing "localStorage.debug=undefined" instead of "delete localStorage.debug".
  // It doesn't work that way.  It may work for other objects, but the values in localStorage
  // are always strings and that leaves us with 'undefined' as a string.  So, let's clean up...
  delete localStorage.debug

  localStorage.version||(localStorage.version='[2,0]') // for migrations to later versions of RIDE
})

prefs = require './prefs'
keymap = require './keymap'
{join, esc, dict, hex, ord, qw, delay} = require './util'

$pfx = $lc = null # DOM elements for "Prefix" and "Locale"
NK = 58 # number of scancodes we are concerned with

layouts = # indexed by scancode; see http://www.abreojosensamblador.net/Productos/AOE/html/Pags_en/ApF.html
  US:
    geometry: 'ansi' # geometries (or "mechanical layouts") are specified as CSS classes
    normal: qw '''
      ☠ ` 1 2 3 4 5 6 7 8 9 0 - = ☠ ☠
      ☠ q w e r t y u i o p [ ] \\
      ☠ a s d f g h j k l ; ' ☠ ☠
      ☠ ☠ z x c v b n m , . / ☠ ☠
    '''
    shifted: qw '''
      ☠ ~ ! @ # $ % ^ & * ( ) _ + ☠ ☠
      ☠ Q W E R T Y U I O P { } |
      ☠ A S D F G H J K L : " ☠ ☠
      ☠ ☠ Z X C V B N M < > ? ☠ ☠
    '''
  UK:
    geometry: 'iso'
    normal: qw '''
      ☠ ` 1 2 3 4 5 6 7 8 9 0 - = ☠ ☠
      ☠ q w e r t y u i o p [ ] ☠
      ☠ a s d f g h j k l ; ' # ☠
      ☠ \\ z x c v b n m , . / ☠ ☠
    '''
    shifted: qw '''
      ☠ ¬ ! " £ $ % ^ & * ( ) _ + ☠ ☠
      ☠ Q W E R T Y U I O P { } ☠
      ☠ A S D F G H J K L : @ ~ ☠
      ☠ | Z X C V B N M < > ? ☠ ☠
    '''
  DK:
    geometry: 'iso'
    normal: qw '''
      ☠ $ 1 2 3 4 5 6 7 8 9 0 + ´ ☠ ☠
      ☠ q w e r t y u i o p å ¨ ☠
      ☠ a s d f g h j k l æ ø ' ☠
      ☠ < z x c v b n m , . - ☠ ☠
    '''
    shifted: qw '''
      ☠ § ! " # € % & / ( ) = ? ` ☠ ☠
      ☠ Q W E R T Y U I O P Å ^ ☠
      ☠ A S D F G H J K L Æ Ø * ☠
      ☠ > Z X C V B N M ; : _ ☠ ☠
    '''

@name = 'Keyboard'

@init = ($e) ->
  specialKeys = 15: '⟵', 16: '↹', 30: 'Caps', 43: '↲', 44: '⇧', 57: '⇧'
  $e.html """
    <label id=kbd-pfx-label>Prefix: <input id=kbd-pfx class=text-field size=1></label>
    <a href=# id=kbd-reset>Reset</a>
    <table id=kbd-legend class=key
           title='Prefix followed by shift+key produces the character in red.\nPrefix followed by an unshifted key produces the character in blue.'>
      <tr><td class=g2>⇧x</td><td class=g3><span class=pfx2>`</span>&nbsp;⇧x</td></tr>
      <tr><td class=g0>x</td><td class=g1><span class=pfx2>`</span>&nbsp;x</td></tr>
    </table>
    <div id=kbd-layout>#{join(
      for i in [1...NK]
        if s = specialKeys[i]
          "<span id=k#{i} class=key>#{esc s}</span>"
        else
          """
            <span id=k#{i} class=key>
              <span class=g2></span><input class=g3><br>
              <span class=g0></span><input class=g1>
            </span>
          """
    )}</div>
    <select id=kbd-lc>#{join((for x, _ of layouts then "<option>#{x}").sort())}</select>
  """
  .on 'focus', '.key input', -> delay 1, (=> $(@).select(); return); return
  .on 'blur', '.key input', -> $(@).val(v = $(@).val()[-1..] || ' ').prop 'title', "U+#{hex ord(v), 4}"; return
  .on 'mouseover mouseout', '.key input', (e) -> $(@).toggleClass 'hover', e.type == 'mouseover'; return
  if !prefs.kbdLocale()
    prefs.kbdLocale(
      switch navigator.language
        when 'en-GB'       then 'UK'
        when 'da', 'da_DK' then 'DK'
        else                    'US'
    )
  $('#kbd-reset').button().click ->
    $pfx.val(prefs.prefixKey.getDefault()).change() # fire a "change" event to update the legend
    loadBQMap keymap.getDefaultBQMap()
    false
  $lc = $('#kbd-lc').val(prefs.kbdLocale()).change ->
    prefs.kbdLocale $(@).val()
    load $.extend {}, keymap.getBQMap(), dict $('#kbd-layout .key').map ->
      [[$('.g0', @).text(), $('.g1', @).val()], [$('.g2', @).text(), $('.g3', @).val()]]
    return
  $pfx = $ '#kbd-pfx'
    .on 'change keyup', -> $('#kbd-legend .pfx2').text $(@).val()[-1..]; return
    .focus -> delay 1, (=> $(@).select(); return); return
  return

@load = load = (bq) -> # bq: current mappings, possibly not yet saved
  $pfx.val(prefs.prefixKey()).change() # fire a "change" event to update the legend
  loadBQMap bq || keymap.getBQMap()
  return

loadBQMap = (bq) ->
  layout = layouts[$lc.val()] || layouts.US
  $('#kbd-layout').removeClass('geometry-ansi geometry-iso').addClass "geometry-#{layout.geometry}"
  for i in [1...NK]
    if (g0 = layout.normal[i]) != '☠'
      g1 = bq[g0] || ' '; $("#k#{i} .g0").text g0; $("#k#{i} .g1").val(g1).prop 'title', "U+#{hex ord(g1), 4}"
    if (g2 = layout.shifted[i]) != '☠'
      g3 = bq[g2] || ' '; $("#k#{i} .g2").text g2; $("#k#{i} .g3").val(g3).prop 'title', "U+#{hex ord(g3), 4}"
  return

@validate = -> if $pfx.val().length != 1 then message: 'Invalid prefix key', element: $pfx

@save = ->
  prefs.prefixKey $pfx.val()
  keymap.setBQMap dict $('#kbd-layout .key').map ->
    [[$('.g0', @).text(), $('.g1', @).val()], [$('.g2', @).text(), $('.g3', @).val()]]
  return

"""River Apps UI Kit: 3D-style illustrations as SVG (original artwork, generated in code; no stock images).
Ported from the Mycarwash v5 mockups. Used by generate.py."""

def bubble(cx, cy, r, p, op=1.0):
    return (f'<g opacity="{op}"><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{p}bub)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r-0.6}" fill="none" stroke="url(#{p}iri)" stroke-width="{max(1,r*0.09):.2f}"/>'
            f'<ellipse cx="{cx-r*0.38:.1f}" cy="{cy-r*0.42:.1f}" rx="{r*0.32:.1f}" ry="{r*0.18:.1f}" fill="#fff" opacity=".85" transform="rotate(-35 {cx-r*0.38:.1f} {cy-r*0.42:.1f})"/>'
            f'<circle cx="{cx+r*0.42:.1f}" cy="{cy+r*0.40:.1f}" r="{r*0.08:.1f}" fill="#fff" opacity=".7"/></g>')

def drop(x, y, s, p, op=1.0):
    # teardrop pointing up, s = height
    w = s*0.62
    return (f'<g transform="translate({x} {y})" opacity="{op}"><path d="M0 {-s/2} C {w*0.15} {-s*0.2}, {w/2} {s*0.02}, {w/2} {s*0.18} A {w/2} {w/2} 0 1 1 {-w/2} {s*0.18} C {-w/2} {s*0.02}, {-w*0.15} {-s*0.2}, 0 {-s/2} Z" fill="url(#{p}drop)"/>'
            f'<ellipse cx="{-w*0.18:.1f}" cy="{s*0.12:.1f}" rx="{w*0.1:.1f}" ry="{s*0.16:.1f}" fill="#fff" opacity=".8"/></g>')

def defs(p, body=('#BFE0FF', '#4C9BFF', '#1F4FD1')):
    t, m, b = body
    return f'''<defs>
<linearGradient id="{p}body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{t}"/><stop offset=".45" stop-color="{m}"/><stop offset="1" stop-color="{b}"/></linearGradient>
<linearGradient id="{p}lower" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{b}" stop-opacity="0"/><stop offset="1" stop-color="#0B1E5B" stop-opacity=".55"/></linearGradient>
<linearGradient id="{p}glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B3442"/><stop offset=".55" stop-color="#121822"/><stop offset="1" stop-color="#06090F"/></linearGradient>
<linearGradient id="{p}refl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="{p}tyre" cx=".45" cy=".4" r=".65"><stop offset="0" stop-color="#3A3D44"/><stop offset=".7" stop-color="#16181C"/><stop offset="1" stop-color="#050506"/></radialGradient>
<radialGradient id="{p}rim" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#D5DAE1"/><stop offset="1" stop-color="#7C8592"/></radialGradient>
<radialGradient id="{p}bub" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#fff" stop-opacity=".04"/><stop offset=".85" stop-color="#E9F4FF" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity=".75"/></radialGradient>
<linearGradient id="{p}iri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB8E1"/><stop offset=".35" stop-color="#B9E2FF"/><stop offset=".7" stop-color="#C7FFE6"/><stop offset="1" stop-color="#FFE9A8"/></linearGradient>
<linearGradient id="{p}drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFEAFF"/><stop offset=".6" stop-color="#5FB2FF"/><stop offset="1" stop-color="#2F7DF0"/></linearGradient>
<radialGradient id="{p}foam" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F1F5FB"/><stop offset="1" stop-color="#C9D3E2"/></radialGradient>
<radialGradient id="{p}head" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBEA"/><stop offset="1" stop-color="#FFD66B"/></radialGradient>
<filter id="{p}blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="{p}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
</defs>'''

def wheel(cx, cy, p):
    spokes = ''.join(f'<rect x="{cx-2.2}" y="{cy-15}" width="4.4" height="13" rx="2.2" fill="#9AA3AF" transform="rotate({a} {cx} {cy})"/>' for a in range(0, 360, 72))
    return (f'<circle cx="{cx}" cy="{cy}" r="29" fill="url(#{p}tyre)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="18" fill="url(#{p}rim)"/>{spokes}'
            f'<circle cx="{cx}" cy="{cy}" r="5.5" fill="#E5E8EC" stroke="#8B95A3" stroke-width="1"/>'
            f'<path d="M{cx-20} {cy-14} A 25 25 0 0 1 {cx+8} {cy-24}" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none" stroke-linecap="round"/>')

def car(p='c', body=None, bubbles=True, foam=True, w=400, extra=''):
    """Side-view glossy hatchback in viewBox 0 0 400 230."""
    d = defs(p) if body is None else defs(p, body)
    shape = ('M34 150 C32 132 40 124 58 120 L98 112 C118 86 140 72 176 68 L246 67 C276 68 296 82 318 104 L352 110 '
             'C370 114 378 124 377 140 L375 154 C374 162 369 165 361 165 L334 165 A34 34 0 0 0 266 165 L139 165 '
             'A34 34 0 0 0 71 165 L46 165 C38 165 35 160 34 150 Z')
    glass = 'M112 112 C130 90 148 80 178 77 L244 76 C268 78 286 90 300 108 Z'
    s = f'<svg viewBox="0 0 400 230" width="{w}" xmlns="http://www.w3.org/2000/svg" class="art">{d}'
    s += f'<ellipse cx="205" cy="198" rx="168" ry="11" fill="#000" opacity=".35" filter="url(#{p}blur)"/>'
    s += f'<path d="{shape}" fill="url(#{p}body)"/>'
    s += f'<path d="{shape}" fill="url(#{p}lower)"/>'
    # shoulder highlight
    s += f'<path d="M60 124 C120 112 250 108 350 116" stroke="#fff" stroke-opacity=".75" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#{p}soft)"/>'
    s += f'<path d="M150 74 C190 70 240 70 270 74" stroke="#fff" stroke-opacity=".8" stroke-width="3" fill="none" stroke-linecap="round"/>'
    s += f'<path d="{glass}" fill="url(#{p}glass)"/>'
    s += f'<path d="M150 108 L176 79 L196 79 L170 108 Z" fill="url(#{p}refl)" opacity=".55"/>'
    s += f'<path d="M232 108 L248 78 L258 79 L242 108 Z" fill="url(#{p}refl)" opacity=".4"/>'
    s += '<rect x="203" y="74" width="7" height="36" rx="2" fill="#0B1E5B" opacity=".55"/>'
    # door seams and handle
    s += '<path d="M206 112 L206 160 M118 116 L124 160" stroke="#0B1E5B" stroke-opacity=".25" stroke-width="1.5"/>'
    s += '<rect x="222" y="122" width="18" height="4" rx="2" fill="#fff" opacity=".6"/><rect x="138" y="124" width="18" height="4" rx="2" fill="#fff" opacity=".6"/>'
    # lights
    s += f'<path d="M356 118 C366 119 372 124 373 132 L356 131 Z" fill="url(#{p}head)"/>'
    s += '<path d="M36 132 C37 126 42 123 50 122 L50 134 Z" fill="#FF5A5F"/>'
    s += '<rect x="330" y="146" width="40" height="5" rx="2.5" fill="#0B1E5B" opacity=".35"/>'
    s += '<path d="M71 165 A34 34 0 0 1 139 165 Z M266 165 A34 34 0 0 1 334 165 Z" fill="#0A0F1C"/>'
    s += wheel(105, 165, p) + wheel(300, 165, p)
    if foam:
        s += '<!--foam-->'
        f = [(150, 66, 13), (168, 58, 16), (190, 56, 14), (210, 60, 17), (232, 58, 13), (250, 64, 11), (178, 70, 10), (222, 70, 11)]
        s += ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#{p}foam)"/>' for x, y, r in f)
        s += ''.join(f'<circle cx="{x-r*.3:.1f}" cy="{y-r*.35:.1f}" r="{r*.28:.1f}" fill="#fff"/>' for x, y, r in f[:6])
        s += f'<circle cx="320" cy="122" r="9" fill="url(#{p}foam)"/><circle cx="332" cy="128" r="6" fill="url(#{p}foam)"/><circle cx="88" cy="126" r="7" fill="url(#{p}foam)"/>'
        s += '<!--/foam-->'
    if bubbles:
        s += '<!--bubbles-->'
        for (x, y, r, o) in [(70, 70, 16, 1), (40, 40, 9, .9), (110, 34, 11, .9), (300, 40, 18, 1), (345, 72, 10, .9), (370, 30, 7, .8), (265, 22, 8, .8), (20, 96, 6, .8)]:
            s += bubble(x, y, r, p, o)
        s += drop(332, 92, 18, p) + drop(64, 104, 14, p, .9)
        s += '<!--/bubbles-->'
    s += extra + '</svg>'
    return s

# ---------- small 3D service icons (viewBox 64) ----------
def icon_defs(p):
    return f'''<defs>
<radialGradient id="{p}b1" cx=".42" cy=".4" r=".6"><stop offset="0" stop-color="#EAF4FF"/><stop offset=".6" stop-color="#9CCBFF"/><stop offset="1" stop-color="#4F95F5"/></radialGradient>
<linearGradient id="{p}iri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9FD2"/><stop offset=".4" stop-color="#7CC4FF"/><stop offset=".75" stop-color="#8CF0C4"/><stop offset="1" stop-color="#FFD66B"/></linearGradient>
<linearGradient id="{p}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4B8"/><stop offset=".45" stop-color="#FFC93C"/><stop offset="1" stop-color="#F08C00"/></linearGradient>
<linearGradient id="{p}peach" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD9BF"/><stop offset=".5" stop-color="#FF8A4C"/><stop offset="1" stop-color="#E4572E"/></linearGradient>
<linearGradient id="{p}lil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7DDFF"/><stop offset=".5" stop-color="#9B7BFF"/><stop offset="1" stop-color="#5B3FD6"/></linearGradient>
<linearGradient id="{p}mint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9F7E1"/><stop offset=".5" stop-color="#34D399"/><stop offset="1" stop-color="#0E9F6E"/></linearGradient>
<linearGradient id="{p}sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D5EBFF"/><stop offset=".5" stop-color="#5FA8FF"/><stop offset="1" stop-color="#2563EB"/></linearGradient>
<radialGradient id="{p}tyre" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#4A4E57"/><stop offset=".7" stop-color="#1B1D22"/><stop offset="1" stop-color="#060708"/></radialGradient>
<radialGradient id="{p}rim" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#D6DBE2"/><stop offset="1" stop-color="#7E8794"/></radialGradient>
<linearGradient id="{p}appl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E9EDF3"/><stop offset="1" stop-color="#AEB8C6"/></linearGradient>
<filter id="{p}sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#0A0A0A" flood-opacity=".22"/></filter>
</defs>'''

def _ib(cx, cy, r, p):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{p}b1)"/><circle cx="{cx}" cy="{cy}" r="{r-.6}" fill="none" stroke="url(#{p}iri)" stroke-width="{max(1.2,r*.12):.1f}"/>'
            f'<ellipse cx="{cx-r*.35:.1f}" cy="{cy-r*.4:.1f}" rx="{r*.3:.1f}" ry="{r*.17:.1f}" fill="#fff" transform="rotate(-35 {cx-r*.35:.1f} {cy-r*.4:.1f})"/>')

_N=[0]
def ico(kind, size=40, p=None):
    _N[0]+=1
    p = p or f'i{kind[:2]}{size}n{_N[0]}'
    s = f'<svg viewBox="0 0 64 64" width="{size}" height="{size}" class="ico">{icon_defs(p)}<g filter="url(#{p}sh)">'
    if kind == 'wash':  # soap bubbles
        s += _ib(26, 36, 17, p) + _ib(44, 24, 11, p) + _ib(47, 45, 8, p)
    elif kind == 'vacuum':  # canister vacuum with hose
        s += f'<path d="M22 20 C22 12 30 8 38 10" stroke="url(#{p}lil)" stroke-width="5" fill="none" stroke-linecap="round"/>'
        s += f'<path d="M38 10 L50 10" stroke="url(#{p}lil)" stroke-width="5" stroke-linecap="round"/><rect x="46" y="6" width="12" height="9" rx="3" fill="url(#{p}lil)"/>'
        s += f'<rect x="8" y="20" width="44" height="30" rx="12" fill="url(#{p}peach)"/>'
        s += '<rect x="14" y="25" width="22" height="8" rx="4" fill="#fff" opacity=".55"/>'
        s += f'<circle cx="41" cy="35" r="6" fill="#fff" opacity=".9"/><circle cx="41" cy="35" r="3" fill="url(#{p}peach)"/>'
        s += f'<circle cx="16" cy="52" r="5" fill="url(#{p}tyre)"/><circle cx="44" cy="52" r="5" fill="url(#{p}tyre)"/>'
    elif kind == 'detail':  # sparkle
        s += f'<path d="M30 6 C32 20 36 26 50 30 C36 34 32 40 30 56 C28 40 24 34 10 30 C24 26 28 20 30 6 Z" fill="url(#{p}gold)"/>'
        s += f'<path d="M50 40 C51 46 53 48 58 49 C53 50 51 52 50 58 C49 52 47 50 42 49 C47 48 49 46 50 40 Z" fill="url(#{p}lil)"/>'
        s += f'<path d="M50 6 C50.6 10 52 11.4 56 12 C52 12.6 50.6 14 50 18 C49.4 14 48 12.6 44 12 C48 11.4 49.4 10 50 6 Z" fill="url(#{p}sky)"/>'
        s += '<path d="M24 22 C26 18 28 16 30 14" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>'
    elif kind == 'tyre':
        s += f'<circle cx="32" cy="32" r="24" fill="url(#{p}tyre)"/>'
        s += ''.join(f'<rect x="30.5" y="8.5" width="3" height="6" rx="1.2" fill="#2E3138" transform="rotate({a} 32 32)"/>' for a in range(0, 360, 30))
        s += f'<circle cx="32" cy="32" r="13" fill="url(#{p}rim)"/>'
        s += ''.join(f'<rect x="30.6" y="21" width="2.8" height="9" rx="1.4" fill="#8E97A4" transform="rotate({a} 32 32)"/>' for a in range(0, 360, 72))
        s += '<circle cx="32" cy="32" r="3.6" fill="#E9ECEF"/><path d="M15 22 A 20 20 0 0 1 30 11" stroke="#fff" stroke-opacity=".3" stroke-width="3" fill="none" stroke-linecap="round"/>'
    elif kind == 'drop':
        s += f'<path d="M32 6 C38 18 50 28 50 40 A18 18 0 0 1 14 40 C14 28 26 18 32 6 Z" fill="url(#{p}sky)"/>'
        s += '<ellipse cx="25" cy="40" rx="4" ry="8" fill="#fff" opacity=".75"/>'
    elif kind == 'car':
        s += f'<path d="M8 40 C8 34 11 32 16 31 L22 23 C24 20 27 19 31 19 L41 19 C45 19 48 21 50 24 L54 31 C58 32 58 35 58 40 L58 44 C58 46 57 47 55 47 L11 47 C9 47 8 46 8 44 Z" fill="url(#{p}sky)"/>'
        s += '<path d="M24 30 L28 23 C29 22 30 21.5 32 21.5 L40 21.5 C42 21.5 43.5 22.5 44.5 24 L48 30 Z" fill="#1A2230"/>'
        s += f'<circle cx="19" cy="47" r="6.5" fill="url(#{p}tyre)"/><circle cx="47" cy="47" r="6.5" fill="url(#{p}tyre)"/><circle cx="19" cy="47" r="2.6" fill="#D6DBE2"/><circle cx="47" cy="47" r="2.6" fill="#D6DBE2"/>'
        s += '<path d="M13 33 C25 31 41 31 53 33" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round"/>'
    elif kind == 'chat':  # SMS bubble
        s += f'<path d="M10 16 C10 11 14 8 19 8 L45 8 C50 8 54 11 54 16 L54 34 C54 39 50 42 45 42 L28 42 L17 51 L19 42 C14 42 10 39 10 34 Z" fill="url(#{p}sky)"/>'
        s += '<circle cx="22" cy="25" r="3.4" fill="#fff"/><circle cx="32" cy="25" r="3.4" fill="#fff"/><circle cx="42" cy="25" r="3.4" fill="#fff"/>'
        s += '<path d="M15 16 C16 13 18 12 21 12" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    elif kind == 'shield':
        s += f'<path d="M32 6 L52 13 L52 30 C52 43 43 52 32 57 C21 52 12 43 12 30 L12 13 Z" fill="url(#{p}mint)"/>'
        s += '<path d="M23 31 L29.5 37.5 L42 25" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        s += '<path d="M17 16 L30 11" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>'
    elif kind == 'check':
        s += f'<circle cx="32" cy="32" r="24" fill="url(#{p}mint)"/>'
        s += '<path d="M21 33 L29 41 L44 25" stroke="#fff" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        s += '<path d="M16 22 A 19 19 0 0 1 30 12" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>'
    elif kind == 'coin':
        s += f'<circle cx="32" cy="32" r="22" fill="url(#{p}gold)"/><circle cx="32" cy="32" r="16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>'
        s += '<text x="32" y="40" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans">₱</text>'
    # ---------- laundry set (Laundry.ph preview; same gradients, light and shadow as the kit icons) ----------
    elif kind in ('washer', 'dryer'):  # front-load machine; washer = water + bubbles, dryer = tumbling clothes
        s += f'<rect x="10" y="5" width="44" height="54" rx="11" fill="url(#{p}appl)"/>'
        s += '<path d="M11 19.5 L53 19.5" stroke="#9AA5B4" stroke-opacity=".45" stroke-width="1.5"/>'
        disp, knob = ('sky', 'gold') if kind == 'washer' else ('peach', 'lil')
        s += f'<rect x="16" y="10" width="13" height="4.5" rx="2.25" fill="url(#{p}{disp})"/>'
        s += f'<circle cx="44" cy="12.3" r="3.8" fill="url(#{p}{knob})"/>'
        s += f'<circle cx="32" cy="39" r="15.5" fill="url(#{p}rim)"/>'
        s += '<circle cx="32" cy="39" r="11.5" fill="#1A2230"/>'
        if kind == 'washer':
            s += f'<path d="M20.7 41 Q26.3 37.4 32 41 T43.3 41 A11.5 11.5 0 0 1 20.7 41 Z" fill="url(#{p}sky)"/>'
            s += '<circle cx="27" cy="45" r="2.1" fill="#fff" opacity=".85"/><circle cx="34.5" cy="47" r="1.5" fill="#fff" opacity=".75"/><circle cx="38" cy="43.2" r="1.1" fill="#fff" opacity=".7"/>'
        else:
            s += f'<path d="M22 43 C22 37 27 35 31 37 C33 33.5 39 34 39.5 38.5 C42.5 39.5 43 44 40.5 46.5 C36 50 26 50 22 46 Z" fill="url(#{p}lil)"/>'
            s += f'<path d="M30 46 C30 41.5 35.5 40 39 42.5 C41.5 44 41.5 47 39.5 48.5 C36.5 50 31.5 50 30 46 Z" fill="url(#{p}peach)"/>'
        s += '<path d="M23.4 33.2 A10.2 10.2 0 0 1 31 29" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
        s += '<path d="M14.5 24 L14.5 51" stroke="#fff" stroke-opacity=".8" stroke-width="2.5" stroke-linecap="round"/>'
    elif kind == 'folded':  # stack of folded clothes
        s += f'<rect x="8" y="42" width="48" height="14" rx="5.5" fill="url(#{p}sky)"/>'
        s += '<rect x="11" y="41.5" width="42" height="3.5" rx="1.75" fill="#0A0A0A" opacity=".14"/>'
        s += f'<rect x="11" y="29" width="42" height="13.5" rx="5.5" fill="url(#{p}mint)"/>'
        s += '<rect x="14" y="28.5" width="36" height="3.5" rx="1.75" fill="#0A0A0A" opacity=".14"/>'
        s += f'<rect x="14" y="16" width="36" height="13.5" rx="5.5" fill="url(#{p}peach)"/>'
        s += '<rect x="36" y="16" width="14" height="13.5" rx="5.5" fill="#fff" opacity=".22"/>'
        for y0, x0, x1 in ((45.5, 13, 51), (32.5, 15.5, 48.5), (19.5, 18, 22)):
            s += f'<path d="M{x0} {y0} L{x1} {y0}" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>'
        s += f'<path d="M52 4 C52.6 8 54 9.4 58 10 C54 10.6 52.6 12 52 16 C51.4 12 50 10.6 46 10 C50 9.4 51.4 8 52 4 Z" fill="url(#{p}gold)"/>'
    elif kind == 'basket':  # laundry basket with clothes
        s += f'<path d="M13 29 C12 20 19 15 26 17 C29 10 40 10 43 17 C49 15 54 21 51 29 Z" fill="url(#{p}lil)"/>'
        s += f'<path d="M31 29 C32 22 39 19.5 45 22.5 C49 24.5 51 27 51 29 Z" fill="url(#{p}peach)"/>'
        s += '<path d="M19 21 C21.5 18.5 24.5 17.5 27.5 18.2" stroke="#fff" stroke-opacity=".65" stroke-width="2" fill="none" stroke-linecap="round"/>'
        s += f'<path d="M9.5 32 L54.5 32 L49.6 54.6 C49.1 57 47.6 58.5 45 58.5 L19 58.5 C16.4 58.5 14.9 57 14.4 54.6 Z" fill="url(#{p}sky)"/>'
        for y, xs in ((38.5, (15.5, 23.5, 31.5, 39.5, 47.5)), (46.5, (17.5, 25.5, 33.5, 41.5))):
            s += ''.join(f'<rect x="{x}" y="{y}" width="{5 if y < 40 else 5}" height="4.2" rx="2.1" fill="#fff" opacity=".42"/>' for x in xs)
        s += f'<rect x="6" y="26.5" width="52" height="8" rx="4" fill="url(#{p}sky)"/>'
        s += '<path d="M10.5 29.2 L53.5 29.2" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>'
    elif kind == 'detergent':  # detergent jug
        s += f'<path d="M35 22 L35 15 C35 12 37 10.5 40 10.5 L45 10.5 C48 10.5 50 12.5 50 15.5 L50 30" stroke="url(#{p}mint)" stroke-width="5.5" fill="none" stroke-linecap="round"/>'
        s += f'<rect x="20" y="15" width="11" height="8" rx="2" fill="url(#{p}mint)"/>'
        s += f'<rect x="18" y="6" width="15" height="10" rx="3.5" fill="url(#{p}peach)"/>'
        s += f'<rect x="13" y="20" width="39" height="39" rx="10" fill="url(#{p}mint)"/>'
        s += '<rect x="20" y="31" width="25" height="19" rx="5.5" fill="#fff" opacity=".92"/>'
        s += _ib(29.5, 42, 5.2, p) + _ib(37.5, 37.5, 3.6, p)
        s += '<path d="M17.5 25.5 L17.5 53" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>'
        s += '<path d="M21 8.5 L29 8.5" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>'
    elif kind == 'iron':  # clothes iron (press / plantsa)
        s += f'<path d="M27 25 L27 17 C27 13 30 11 34 11 L50 11 C54 11 56 13 56 17 L56 25" stroke="url(#{p}peach)" stroke-width="5.5" fill="none" stroke-linecap="round"/>'
        s += f'<path d="M7 46 C9 32 21 23 38 23 L52 23 C55 23 57 25 57 28 L57 46 Z" fill="url(#{p}peach)"/>'
        s += f'<path d="M5.5 46 L58.5 46 L58.5 49.5 C58.5 52 57 53.5 54.5 53.5 L10.5 53.5 C7 53.5 5 50.5 5.5 46 Z" fill="url(#{p}rim)"/>'
        s += '<circle cx="45" cy="35" r="4.5" fill="#fff" opacity=".9"/><circle cx="45" cy="35" r="1.8" fill="#E4572E"/>'
        s += '<path d="M15 39 C18.5 32.5 25 28 33 27" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    elif kind == 'ewallet':  # phone wallet (GCash / Maya / QR Ph payment)
        s += f'<rect x="15" y="5" width="30" height="52" rx="8" fill="url(#{p}sky)"/>'
        s += '<rect x="19" y="11" width="22" height="36" rx="4" fill="#fff" opacity=".92"/>'
        s += '<rect x="25.5" y="51" width="9" height="2.6" rx="1.3" fill="#fff" opacity=".7"/>'
        s += '<path d="M23 17 L37 17 M23 22 L33 22" stroke="#9CCBFF" stroke-width="2.4" stroke-linecap="round"/>'
        s += f'<circle cx="44" cy="40" r="13" fill="url(#{p}gold)"/><circle cx="44" cy="40" r="9.2" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>'
        s += '<text x="44" y="45" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans">₱</text>'
        s += '<path d="M18.5 10 L18.5 30" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>'
    s += '</g></svg>'
    return s

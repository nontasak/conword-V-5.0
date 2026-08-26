import math
import zlib
import struct
import os

def create_png(width, height, rgba_data, filename):
    raw_scanlines = bytearray()
    for y in range(height):
        raw_scanlines.append(0) # filter type 0
        start = y * width * 4
        raw_scanlines.extend(rgba_data[start:start + width * 4])
    
    compressed = zlib.compress(bytes(raw_scanlines), 9)
    
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        crc = zlib.crc32(tag + data) & 0xffffffff
        return c + struct.pack('>I', crc)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr))
    png.extend(chunk(b'IDAT', compressed))
    png.extend(chunk(b'IEND', b''))
    
    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)

def generate_svg():
    # Exactly matches the user's uploaded logo geometry:
    # Sky blue body (#6BA8D6), pure white fold layers/gaps (#FFFFFF), navy pencil tip (#256188 and #113554)
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%" fill="none">
  <!-- Conword V.5 Official High-Fidelity Logo -->
  <g id="conword-logo">
    <!-- Ribbon 1: Outermost Left Leaf/Flap & Bottom Pencil Body -->
    <path d="M 12 166 L 76 182 C 76 182 82 286 128 376 C 172 418 226 442 388 442 L 388 478 C 220 478 124 456 46 362 C 14 300 10 220 12 166 Z" fill="#6BA8D6" />

    <!-- Ribbon 2: Middle Leaf/Fold -->
    <path d="M 78 54 L 140 76 C 122 136 116 208 152 300 C 182 334 228 356 388 356 L 388 386 C 220 386 142 358 100 274 C 74 196 74 110 78 54 Z" fill="#6BA8D6" />

    <!-- Ribbon 3: Top Crest & Inner "C" Curl -->
    <path d="M 204 12 L 448 116 C 458 138 424 186 372 224 C 318 172 262 172 228 206 C 208 230 204 268 232 306 C 260 340 318 344 388 344 L 388 322 C 318 322 274 320 258 300 C 244 282 246 260 264 242 C 288 218 326 218 370 246 L 392 224 C 420 196 438 158 420 140 L 204 12 Z" fill="#6BA8D6" />

    <!-- Sharp Pencil Tip Facet 1 (Upper Medium Navy) -->
    <polygon points="388,326 498,384 388,384" fill="#256188" />

    <!-- Sharp Pencil Tip Facet 2 (Lower Deep Navy) -->
    <polygon points="388,384 498,384 388,442" fill="#113554" />
  </g>
</svg>'''
    return svg

def bezier_pts(p0, p1, p2, p3, num=30):
    pts = []
    for i in range(num):
        t = i / float(num)
        u = 1.0 - t
        x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0]
        y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]
        pts.append((x, y))
    return pts

def line_pts(p0, p1, num=10):
    pts = []
    for i in range(num):
        t = i / float(num)
        pts.append((p0[0] + t*(p1[0]-p0[0]), p0[1] + t*(p1[1]-p0[1])))
    return pts

def rasterize_poly(poly, w, h, col, buf):
    min_y = max(0, int(min(p[1] for p in poly)))
    max_y = min(h - 1, int(max(p[1] for p in poly)))
    n = len(poly)
    for y in range(min_y, max_y + 1):
        py = y + 0.5
        nodes = []
        p1x, p1y = poly[0]
        for i in range(n + 1):
            p2x, p2y = poly[i % n]
            if (p1y < py and p2y >= py) or (p2y < py and p1y >= py):
                x = p1x + (py - p1y) / (p2y - p1y) * (p2x - p1x)
                nodes.append(x)
            p1x, p1y = p2x, p2y
        nodes.sort()
        for i in range(0, len(nodes) - 1, 2):
            x_start = max(0, int(nodes[i]))
            x_end = min(w - 1, int(nodes[i+1]))
            for x in range(x_start, x_end + 1):
                idx = (y * w + x) * 4
                buf[idx] = col[0]
                buf[idx+1] = col[1]
                buf[idx+2] = col[2]
                buf[idx+3] = col[3]

def render_logo(size):
    ss = 4 # 4x Supersampling for ultra-smooth edges
    w_ss = size * ss
    h_ss = size * ss
    scale_ss = w_ss / 512.0

    def s(poly):
        return [(p[0] * scale_ss, p[1] * scale_ss) for p in poly]

    poly1 = []
    poly1.extend(line_pts((12, 166), (76, 182)))
    poly1.extend(bezier_pts((76, 182), (82, 286), (128, 376), (226, 442)))
    poly1.extend(line_pts((226, 442), (388, 442)))
    poly1.extend(line_pts((388, 442), (388, 478)))
    poly1.extend(line_pts((388, 478), (220, 478)))
    poly1.extend(bezier_pts((220, 478), (124, 456), (46, 362), (14, 300)))
    poly1.extend(bezier_pts((14, 300), (10, 220), (12, 180), (12, 166)))

    poly2 = []
    poly2.extend(line_pts((78, 54), (140, 76)))
    poly2.extend(bezier_pts((140, 76), (122, 136), (116, 208), (152, 300)))
    poly2.extend(bezier_pts((152, 300), (182, 334), (228, 356), (388, 356)))
    poly2.extend(line_pts((388, 356), (388, 386)))
    poly2.extend(line_pts((388, 386), (220, 386)))
    poly2.extend(bezier_pts((220, 386), (142, 358), (100, 274), (78, 180)))
    poly2.extend(bezier_pts((78, 180), (74, 110), (76, 70), (78, 54)))

    poly3 = []
    poly3.extend(line_pts((204, 12), (448, 116)))
    poly3.extend(bezier_pts((448, 116), (458, 138), (424, 186), (372, 224)))
    poly3.extend(bezier_pts((372, 224), (318, 172), (262, 172), (228, 206)))
    poly3.extend(bezier_pts((228, 206), (208, 230), (204, 268), (232, 306)))
    poly3.extend(bezier_pts((232, 306), (260, 340), (318, 344), (388, 344)))
    poly3.extend(line_pts((388, 344), (388, 322)))
    poly3.extend(line_pts((388, 322), (318, 322)))
    poly3.extend(bezier_pts((318, 322), (274, 320), (258, 300), (244, 282)))
    poly3.extend(bezier_pts((244, 282), (246, 260), (264, 242), (288, 218)))
    poly3.extend(bezier_pts((288, 218), (326, 218), (370, 246), (392, 224)))
    poly3.extend(bezier_pts((392, 224), (420, 196), (438, 158), (420, 140)))
    poly3.extend(line_pts((420, 140), (204, 12)))

    pencil_top = [(388, 326), (498, 384), (388, 384)]
    pencil_bot = [(388, 384), (498, 384), (388, 442)]

    c_blue = (107, 168, 214, 255)       # #6BA8D6
    c_pencil_top = (37, 97, 136, 255)   # #256188
    c_pencil_bot = (17, 53, 84, 255)    # #113554

    ss_buf = bytearray(w_ss * h_ss * 4)
    rasterize_poly(s(poly1), w_ss, h_ss, c_blue, ss_buf)
    rasterize_poly(s(poly2), w_ss, h_ss, c_blue, ss_buf)
    rasterize_poly(s(poly3), w_ss, h_ss, c_blue, ss_buf)
    rasterize_poly(s(pencil_top), w_ss, h_ss, c_pencil_top, ss_buf)
    rasterize_poly(s(pencil_bot), w_ss, h_ss, c_pencil_bot, ss_buf)

    out_buf = bytearray(size * size * 4)
    ss2 = ss * ss
    for y in range(size):
        for x in range(size):
            r_acc, g_acc, b_acc, a_acc = 0, 0, 0, 0
            for sy in range(ss):
                for sx in range(ss):
                    sidx = ((y * ss + sy) * w_ss + (x * ss + sx)) * 4
                    a = ss_buf[sidx + 3]
                    if a > 0:
                        r_acc += ss_buf[sidx]
                        g_acc += ss_buf[sidx + 1]
                        b_acc += ss_buf[sidx + 2]
                        a_acc += a
            
            if a_acc > 0:
                count = a_acc / 255.0
                out_idx = (y * size + x) * 4
                out_buf[out_idx] = int(r_acc / (count if count > 0 else 1))
                out_buf[out_idx + 1] = int(g_acc / (count if count > 0 else 1))
                out_buf[out_idx + 2] = int(b_acc / (count if count > 0 else 1))
                out_buf[out_idx + 3] = int(a_acc / ss2)

    return out_buf

def main():
    # 1. Write SVG
    svg = generate_svg()
    for p in ['public/favicon.svg', 'dist/favicon.svg']:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w') as f:
                f.write(svg)
        except Exception as e:
            print(f'SVG write error: {e}')

    # 2. Write PNGs
    for size in [512, 192, 32, 16]:
        buf = render_logo(size)
        if size == 512:
            create_png(size, size, buf, 'public/favicon.png')
            create_png(size, size, buf, 'public/logo.png')
            if os.path.exists('dist'):
                create_png(size, size, buf, 'dist/favicon.png')
                create_png(size, size, buf, 'dist/logo.png')
        elif size == 192:
            create_png(size, size, buf, 'public/favicon-192.png')
            if os.path.exists('dist'):
                create_png(size, size, buf, 'dist/favicon-192.png')
        elif size == 32:
            create_png(size, size, buf, 'public/favicon-32.png')
            if os.path.exists('dist'):
                create_png(size, size, buf, 'dist/favicon-32.png')

    print('High-Fidelity logo assets generated successfully!')

if __name__ == '__main__':
    main()

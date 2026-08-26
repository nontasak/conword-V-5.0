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

def cubic_bezier(p0, p1, p2, p3, num_points=30):
    points = []
    for i in range(num_points):
        t = i / num_points
        u = 1.0 - t
        x = u*u*u * p0[0] + 3*u*u*t * p1[0] + 3*u*t*t * p2[0] + t*t*t * p3[0]
        y = u*u*u * p0[1] + 3*u*u*t * p1[1] + 3*u*t*t * p2[1] + t*t*t * p3[1]
        points.append((x, y))
    return points

def line_pts(p0, p1, num_points=8):
    points = []
    for i in range(num_points):
        t = i / num_points
        points.append((p0[0] + t*(p1[0]-p0[0]), p0[1] + t*(p1[1]-p0[1])))
    return points

def rasterize_poly_to_grid(poly, w, h, col, buf):
    # Scanline rasterization (ultra-fast O(edges * height))
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

def generate_svg():
    # Maximum size, zero wasted padding, crystal clear paths
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" width="100%" height="100%">
  <!-- Conword V.5 Official Stylized Logo / Favicon -->
  <g id="conword-icon">
    <!-- Ribbon 1: Leftmost outer paper flap & lower swoosh -->
    <path d="M 24,182 L 90,200 C 90,200 96,305 142,398 C 190,442 245,432 382,432 L 382,492 C 245,492 110,465 24,325 C 18,255 18,212 24,182 Z" fill="#68A7D7"/>

    <!-- Ribbon 2: Middle paper wave -->
    <path d="M 94,62 L 158,88 C 138,152 132,225 172,322 C 205,360 252,358 382,358 L 382,398 C 238,398 138,340 96,230 C 82,150 86,98 94,62 Z" fill="#68A7D7"/>

    <!-- Ribbon 3: Top paper crest & Main inner C loop -->
    <path d="M 224,18 L 438,124 C 448,145 412,196 358,236 C 302,182 242,182 206,218 C 186,242 182,282 212,322 C 242,358 302,358 382,358 L 382,318 C 302,318 252,318 238,296 C 222,276 226,252 246,232 C 272,206 312,206 358,236 L 382,212 C 412,182 432,142 412,122 L 224,18 Z" fill="#68A7D7"/>

    <!-- Pencil Tip: Upper facet (Navy Blue) -->
    <polygon points="382,358 494,425 382,425" fill="#1E5884"/>

    <!-- Pencil Tip: Lower facet (Deep Navy Blue) -->
    <polygon points="382,425 494,425 382,492" fill="#103554"/>
  </g>
</svg>'''
    return svg

def render_logo(size):
    ss = 2
    w_ss = size * ss
    h_ss = size * ss
    scale_ss = w_ss / 512.0

    def s(poly):
        return [(p[0] * scale_ss, p[1] * scale_ss) for p in poly]

    # Ribbon 1
    poly1 = []
    poly1.extend(line_pts((24, 182), (90, 200)))
    poly1.extend(cubic_bezier((90, 200), (96, 305), (142, 398), (245, 432)))
    poly1.extend(line_pts((245, 432), (382, 432)))
    poly1.extend(line_pts((382, 432), (382, 492)))
    poly1.extend(line_pts((382, 492), (245, 492)))
    poly1.extend(cubic_bezier((245, 492), (110, 465), (24, 325), (18, 255)))
    poly1.extend(line_pts((18, 255), (24, 182)))

    # Ribbon 2
    poly2 = []
    poly2.extend(line_pts((94, 62), (158, 88)))
    poly2.extend(cubic_bezier((158, 88), (138, 152), (132, 225), (172, 322)))
    poly2.extend(cubic_bezier((172, 322), (205, 360), (252, 358), (382, 358)))
    poly2.extend(line_pts((382, 358), (382, 398)))
    poly2.extend(line_pts((382, 398), (238, 398)))
    poly2.extend(cubic_bezier((238, 398), (138, 340), (82, 150), (94, 62)))

    # Ribbon 3
    poly3 = []
    poly3.extend(line_pts((224, 18), (438, 124)))
    poly3.extend(cubic_bezier((438, 124), (448, 145), (412, 196), (358, 236)))
    poly3.extend(cubic_bezier((358, 236), (302, 182), (242, 182), (206, 218)))
    poly3.extend(cubic_bezier((206, 218), (186, 242), (182, 282), (212, 322)))
    poly3.extend(cubic_bezier((212, 322), (242, 358), (302, 358), (382, 358)))
    poly3.extend(line_pts((382, 358), (382, 318)))
    poly3.extend(line_pts((382, 318), (280, 318)))
    poly3.extend(cubic_bezier((280, 318), (238, 296), (226, 252), (246, 232)))
    poly3.extend(cubic_bezier((246, 232), (272, 206), (312, 206), (358, 236)))
    poly3.extend(line_pts((358, 236), (382, 212)))
    poly3.extend(cubic_bezier((382, 212), (412, 182), (432, 142), (412, 122)))
    poly3.extend(line_pts((412, 122), (224, 18)))

    # Pencil facets
    pencil_top = [(382, 358), (494, 425), (382, 425)]
    pencil_bot = [(382, 425), (494, 425), (382, 492)]

    c_ribbon = (104, 167, 215, 255) # #68A7D7
    c_pencil_top = (30, 88, 132, 255) # #1E5884
    c_pencil_bot = (16, 53, 84, 255) # #103554

    ss_buf = bytearray(w_ss * h_ss * 4)

    # Rasterize ribbons
    rasterize_poly_to_grid(s(poly1), w_ss, h_ss, c_ribbon, ss_buf)
    rasterize_poly_to_grid(s(poly2), w_ss, h_ss, c_ribbon, ss_buf)
    rasterize_poly_to_grid(s(poly3), w_ss, h_ss, c_ribbon, ss_buf)
    rasterize_poly_to_grid(s(pencil_top), w_ss, h_ss, c_pencil_top, ss_buf)
    rasterize_poly_to_grid(s(pencil_bot), w_ss, h_ss, c_pencil_bot, ss_buf)

    # Downsample
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
    svg_content = generate_svg()
    
    # Save SVGs
    for p in ['public/favicon.svg', 'dist/favicon.svg']:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w') as f:
                f.write(svg_content)
        except Exception as e:
            print(f'Error writing {p}: {e}')
    
    # Save PNGs
    for size in [512, 192, 32, 16]:
        buf = render_logo(size)
        if size == 512:
            create_png(size, size, buf, 'public/favicon.png')
            create_png(size, size, buf, 'public/logo.png')
            create_png(size, size, buf, 'dist/favicon.png')
            create_png(size, size, buf, 'dist/logo.png')
        elif size == 192:
            create_png(size, size, buf, 'public/favicon-192.png')
        elif size == 32:
            create_png(size, size, buf, 'public/favicon-32.png')

    print('All Favicons and Logos generated successfully!')

if __name__ == '__main__':
    main()

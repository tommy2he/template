from ursina import *

# ---------- 初始化应用 ----------
app = Ursina(borderless=False, title='Box Render Test')

# ---------- 关闭调试信息（可选）----------
window.fps_counter.enabled = False
window.entity_counter.enabled = False
window.exit_button.visible = False

# ---------- 光源设置（保证物体明亮）----------
scene.ambient_light = color.rgba(180, 180, 180, 255)
# 主光源：白色，从左上角照射
PointLight(position=(5, 10, 5), color=color.white, intensity=1.2)
# 辅助背光，减少阴影死黑
PointLight(position=(-5, 5, -5), color=color.white, intensity=0.5)

# ---------- 基础地板（参考）----------
floor = Entity(
    model='plane',
    scale=(20, 1, 20),
    color=color.rgb(200, 200, 200),
    texture='white_cube',
    position=(0, -0.5, 0),
    rotation_x=0,
    collider=None
)

# ---------- 辅助网格（便于观察位置）----------
grid = Entity(
    model=Grid(10, 10),
    scale=10,
    position=(0, -0.4, 0),
    rotation_x=90,
    color=color.light_gray
)

# ========== 各种箱子样式 ==========
# 我们将箱子排列在一条横线上，方便对比
start_x = -8
spacing = 3.5
y_pos = 0.3   # 箱子中心高度

boxes = []

# ---------- 样式1：纯色立方体，unlit=True（绝对可见，无纹理）----------
box1 = Entity(
    model='cube',
    scale=(1, 1, 1),
    position=(start_x, y_pos, 0),
    color=color.red,
    texture=None,
    unlit=True,
    collider=None
)
boxes.append(box1)
# 添加黑色边框，增加立体感
Entity(model='wireframe_cube', scale=(1.02, 1.02, 1.02),
       position=(start_x, y_pos, 0), color=color.black, unlit=True, parent=box1)
Text(text='Unlit Red + Border', position=(start_x, y_pos-0.8, 0), scale=2, origin=(0,0))

# ---------- 样式2：纯色立方体，unlit=False（受光照影响）----------
box2 = Entity(
    model='cube',
    scale=(1, 1, 1),
    position=(start_x + spacing, y_pos, 0),
    color=color.orange,
    texture=None,
    unlit=False,
    collider=None
)
boxes.append(box2)
Text(text='Lit Orange', position=(start_x+spacing, y_pos-0.8, 0), scale=2, origin=(0,0))

# ---------- 样式3：带纹理的立方体（使用Ursina内置纹理）----------
# 尝试'brick'纹理（墙常用）
box3 = Entity(
    model='cube',
    scale=(1, 1, 1),
    position=(start_x + spacing*2, y_pos, 0),
    color=color.white,
    texture='brick',
    unlit=False,
    collider=None
)
boxes.append(box3)
Text(text='Brick Texture', position=(start_x+spacing*2, y_pos-0.8, 0), scale=2, origin=(0,0))

# ---------- 样式4：带纹理的立方体（尝试其他纹理）----------
# 'grass'纹理
box4 = Entity(
    model='cube',
    scale=(1, 1, 1),
    position=(start_x + spacing*3, y_pos, 0),
    color=color.white,
    texture='grass',
    unlit=False,
    collider=None
)
boxes.append(box4)
Text(text='Grass Texture', position=(start_x+spacing*3, y_pos-0.8, 0), scale=2, origin=(0,0))

# ---------- 样式5：球体 + 光环（您当前使用的方案）----------
box5 = Entity(
    model='sphere',
    scale=(0.8, 0.8, 0.8),
    position=(start_x + spacing*4, y_pos+0.1, 0),
    color=color.red,
    texture=None,
    unlit=True,
    collider=None
)
# 金色光环
Entity(model='torus', scale=(1.1, 1.1, 0.3), rotation=(90,0,0),
       position=(start_x + spacing*4, y_pos+0.1, 0),
       color=color.gold, unlit=True, parent=box5)
Text(text='Sphere + Ring', position=(start_x+spacing*4, y_pos-0.8, 0), scale=2, origin=(0,0))

# ---------- 样式6：纯色立方体 + 边缘高光（尝试不同颜色）----------
box6 = Entity(
    model='cube',
    scale=(1, 1, 1),
    position=(start_x + spacing*5, y_pos, 0),
    color=color.rgb(180, 80, 30),  # 温暖的橙棕色
    texture=None,
    unlit=False,                   # 受光照，有立体感
    collider=None
)
# 添加细黑边
Entity(model='wireframe_cube', scale=(1.02, 1.02, 1.02),
       position=(start_x + spacing*5, y_pos, 0), color=color.black, unlit=True, parent=box6)
Text(text='Warm Brown + Light', position=(start_x+spacing*5, y_pos-0.8, 0), scale=2, origin=(0,0))

# ---------- 样式7：使用白色发光纹理（'white_cube'）----------
box7 = Entity(
    model='cube',
    scale=(1, 1, 1),
    position=(start_x + spacing*6, y_pos, 0),
    color=color.rgb(200, 100, 50),
    texture='white_cube',
    unlit=False,
    collider=None
)
Text(text='White Cube Tex', position=(start_x+spacing*6, y_pos-0.8, 0), scale=2, origin=(0,0))

# ---------- 摄像机设置（俯视角度，看清所有箱子）----------
camera.position = (0, 8, -20)
camera.look_at((0, 0.5, 0))
camera.fov = 50

# ---------- 简单交互：按数字键切换箱子颜色/纹理（演示动态调整）----------
def input(key):
    if key == '1':
        box1.color = color.random_color()
    elif key == '2':
        box2.color = color.random_color()
    elif key == '3':
        box3.texture = 'stone' if box3.texture == 'brick' else 'brick'
    elif key == '4':
        box4.texture = 'wood' if box4.texture == 'grass' else 'grass'
    elif key == '5':
        box5.color = color.random_color()
    elif key == '6':
        box6.color = color.random_color()
    elif key == '7':
        box7.texture = None if box7.texture else 'white_cube'
    elif key == 'space':
        # 旋转视角
        camera.rotation_y += 45
        camera.look_at((0, 0.5, 0))

def update():
    # 让箱子缓慢自转，方便观察各个面
    for i, box in enumerate(boxes):
        box.rotation_y += 10 * time.dt * (1 if i % 2 == 0 else -1)

# ---------- 屏幕提示 ----------
Text(text='Test Box Render - 1~7 change style, SPACE rotate view',
     origin=(0,0), scale=1.5, color=color.white, position=(0, 0.45), background=True)

if __name__ == '__main__':
    window.size = (1400, 800)
    app.run()
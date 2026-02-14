from ursina import *
import copy

app = Ursina(borderless=False, title='3D Sokoban')

# ---------- 关闭调试信息 ----------
window.fps_counter.enabled = False
window.entity_counter.enabled = False
window.exit_button.visible = False

# ---------- 光源（加强，让纹理更清晰）----------
scene.ambient_light = color.rgba(200, 200, 200, 255)
PointLight(position=(10, 20, 10), color=color.white, intensity=1.2)

# ---------- 关卡数据（6x5，可解）----------
level = [
    [1, 1, 1, 1, 1],
    [1, 4, 0, 3, 1],
    [1, 0, 2, 0, 1],
    [1, 0, 2, 3, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
]
initial_level = copy.deepcopy(level)

rows = len(level)
cols = len(level[0])

# ---------- 全局参数 ----------
tile_size = 2
wall_height = 0.5
box_height = 0.5
player_height = 0.8
target_scale = 0.4          # 目标圆环缩小

wall_color = color.brown
player_color = color.azure
target_color = color.gold
floor_color = color.rgb(180, 180, 180)

boxes = []
targets = []
player = None

# ---------- 深色地面平面（网格的衬底）----------
ground = Entity(
    model='plane',
    scale=(cols * tile_size, 1, rows * tile_size),
    position=(cols * tile_size / 2 - tile_size / 2, -0.01,
              rows * tile_size / 2 - tile_size / 2),
    color=color.rgb(30, 30, 30),   # 深灰色，与浅色网格形成鲜明对比
    texture=None,
    unlit=True,
    collider=None
)


# ---------- 网格 ----------
# grid = Entity(
#     model=Grid(cols, rows),
#     scale=tile_size,
#     position=(cols * tile_size / 2 - tile_size / 2, -0.01,
#               rows * tile_size / 2 - tile_size / 2),
#     rotation_x=0,
#     color=color.light_gray
# )
# grid = Entity(
#     model=Grid(cols, rows),
#     scale=tile_size,
#     position=(cols * tile_size / 2 - tile_size / 2, 0.02,   # 浮在地板上方
#               rows * tile_size / 2 - tile_size / 2),
#     rotation_x=90,        # 平铺（XZ平面）
#     color=color.light_gray
# )

# grid = Entity(
#     model=Grid(cols, rows),
#     scale=tile_size,
#     position=(cols * tile_size / 2 - tile_size / 2, 0,   # Y=0，与箱子、玩家底部平齐
#               rows * tile_size / 2 - tile_size / 2),
#     rotation_x=90,
#     color=color.dark_gray      # 深灰色，清晰可见
# )


grid = Entity(
    model=Grid(cols, rows),
    scale=tile_size,
    position=(cols * tile_size / 2 - tile_size / 2, 0.01,   # 高出地面一点点
              rows * tile_size / 2 - tile_size / 2),
    rotation_x=90,
    # color=color.light_gray        # 浅灰色网格，在深色背景上清晰可见
    color=color.white
)


# ---------- 构建关卡（行序反转：第0行在屏幕上方）----------
def build_level(lvl):
    global player, boxes, targets
    boxes = []
    targets = []

    for z in range(rows):
        for x in range(cols):
            cell = lvl[z][x]
            world_z = (rows - 1 - z) * tile_size
            pos = Vec3(x * tile_size, 0, world_z)

            # 地板（纯灰色，无纹理，不受光照影响）
            # floor = Entity(
            #     model='cube',
            #     scale=(tile_size * 0.9, 0.1, tile_size * 0.9),
            #     position=pos + Vec3(0, -0.05, 0),
            #     color=floor_color,
            #     texture=None,
            #     unlit=True,
            #     collider='box' if cell == 1 else None,
            # )

            # 墙（红砖纹理）
            if cell == 1:
                wall = Entity(
                    model='cube',
                    scale=(tile_size, wall_height, tile_size),
                    position=pos + Vec3(0, wall_height / 2, 0),
                    color=wall_color,
                    texture='brick',
                    collider='box'
                )

            # 目标点：金色圆环，永远面向摄像机
            if cell in (3, 5):
                target = Entity(
                    model='quad',
                    scale=(tile_size * target_scale, tile_size * target_scale, 1),
                    position=pos + Vec3(0, 0.2, 0),
                    color=target_color,
                    texture='circle',
                    billboard=True,
                    double_sided=True,
                    always_on_top=True
                )
                targets.append(target)

            # ---------- ★ 箱子：绿色草地纹理立方体（您选中的方案）----------
            if cell == 2:
                box = Entity(
                    model='cube',
                    scale=(tile_size * 0.7, box_height, tile_size * 0.7),
                    position=pos + Vec3(0, box_height / 2, 0),
                    color=color.white,          # 白色光下呈现纹理本色
                    texture='grass',            # 绿色草地纹理
                    unlit=False,               # 受光照，更有立体感
                    collider=None
                )
                # 添加细黑边，增加轮廓（可选，若不想要可删除）
                Entity(model='wireframe_cube',
                       scale=(tile_size * 0.71, box_height * 1.01, tile_size * 0.71),
                       position=pos + Vec3(0, box_height / 2, 0),
                       color=color.black,
                       unlit=True,
                       parent=box)
                boxes.append(box)

            # ---------- 玩家：蓝色球体 + 大眼睛（朝向摄像机）----------
            if cell in (4, 5):
                player = Entity(
                    model='sphere',
                    scale=(tile_size * 0.6, player_height, tile_size * 0.6),
                    position=pos + Vec3(0, player_height / 2, 0),
                    color=player_color,
                    texture=None,
                    unlit=True,
                    collider=None
                )
                # 眼睛放在 -Z 侧（面向摄像机）
                eye_scale = 0.15
                eye_offset = 0.25
                eye_y = 0.1
                eye_z = -0.35
                # 左眼
                Entity(model='sphere', scale=eye_scale,
                       position=Vec3(-eye_offset, eye_y, eye_z),
                       color=color.black, unlit=True, parent=player)
                # 右眼
                Entity(model='sphere', scale=eye_scale,
                       position=Vec3(eye_offset, eye_y, eye_z),
                       color=color.black, unlit=True, parent=player)
                # 眼白高光
                Entity(model='sphere', scale=0.05,
                       position=Vec3(-eye_offset+0.05, eye_y+0.05, eye_z-0.1),
                       color=color.white, unlit=True, parent=player)
                Entity(model='sphere', scale=0.05,
                       position=Vec3(eye_offset+0.05, eye_y+0.05, eye_z-0.1),
                       color=color.white, unlit=True, parent=player)

build_level(level)

# ---------- 纯英文操作提示（无乱码）----------
hint = Text(
    text='[W] Up  [S] Down  [A] Left  [D] Right    [R] Reset    [Space] Rotate',
    origin=(0, -0.5), scale=1.5, color=color.white,
    position=(0, 0.45), background=True
)

# ---------- 地图中心 ----------
center_x = cols * tile_size / 2 - tile_size / 2
center_z = (rows - 1) * tile_size / 2
map_center = Vec3(center_x, 0, center_z)

# ---------- 摄像机：拉近 + 小FOV，画面放大----------
camera.orthographic = False
cam_dist = max(cols, rows) * tile_size * 1.2   # 距离系数1.2（原1.8）
camera.position = Vec3(center_x, rows * tile_size * 0.8, -cam_dist)
camera.look_at(map_center)
camera.fov = 50      # 原60，进一步放大物体

# ---------- 坐标转换（世界 ↔ 数组，处理Z反转）----------
def world_to_grid(pos):
    x = int(round(pos.x / tile_size))
    world_z = int(round(pos.z / tile_size))
    z = rows - 1 - world_z
    return x, z

def grid_to_world(x, z):
    world_z = (rows - 1 - z) * tile_size
    return Vec3(x * tile_size, 0, world_z)

# ---------- 玩家移动逻辑 ----------
def move_player(dx, dz):
    global level

    px, pz = world_to_grid(player.position)
    nx, nz = px + dx, pz + dz

    if nx < 0 or nx >= cols or nz < 0 or nz >= rows:
        return

    cell = level[nz][nx]

    # 空地或目标点
    if cell in (0, 3):
        player.position = grid_to_world(nx, nz) + Vec3(0, player_height / 2, 0)
        if level[pz][px] == 4:
            level[pz][px] = 0
        else:   # 5
            level[pz][px] = 3
        level[nz][nx] = 4 if cell == 0 else 5

    # 箱子
    elif cell == 2:
        bx, bz = nx + dx, nz + dz
        if bx < 0 or bx >= cols or bz < 0 or bz >= rows:
            return
        target_cell = level[bz][bx]
        if target_cell in (0, 3):
            # 移动箱子
            for box in boxes:
                box_x, box_z = world_to_grid(box.position)
                if box_x == nx and box_z == nz:
                    box.position = grid_to_world(bx, bz) + Vec3(0, box_height / 2, 0)
                    break
            # 移动玩家
            player.position = grid_to_world(nx, nz) + Vec3(0, player_height / 2, 0)

            # 更新关卡数组
            if level[pz][px] == 4:
                level[pz][px] = 0
            else:
                level[pz][px] = 3
            level[nz][nx] = 4
            level[bz][bx] = 2 if target_cell == 0 else 6

    # 胜利判定
    win = all(level[world_to_grid(t.position)[1]][world_to_grid(t.position)[0]] == 6
              for t in targets)
    if win:
        print("🎉 You Win!")
        Text(text='You Win!', origin=(0, 0), scale=3, color=color.gold)

# ---------- 键盘控制（W向上，S向下）----------
def input(key):
    if key in ('w', 'up arrow'):
        move_player(0, -1)   # 减少行索引 = 向屏幕上方
    elif key in ('s', 'down arrow'):
        move_player(0, 1)    # 增加行索引 = 向屏幕下方
    elif key in ('a', 'left arrow'):
        move_player(-1, 0)
    elif key in ('d', 'right arrow'):
        move_player(1, 0)
    elif key == 'r':
        global level, rows, cols
        level = copy.deepcopy(initial_level)
        rows = len(level)
        cols = len(level[0])
        for e in scene.entities[:]:
            if e not in (grid, hint, ground):
                destroy(e)
        boxes.clear()
        targets.clear()
        build_level(level)
        # 重置摄像机
        center_x = cols * tile_size / 2 - tile_size / 2
        center_z = (rows - 1) * tile_size / 2
        cam_dist = max(cols, rows) * tile_size * 1.2
        camera.position = Vec3(center_x, rows * tile_size * 0.8, -cam_dist)
        camera.look_at(Vec3(center_x, 0, center_z))
        camera.fov = 50
    elif key == 'space':
        camera.rotation_y += 45
        camera.look_at(map_center)

def update():
    pass

if __name__ == '__main__':
    window.size = (1200, 800)
    app.run()
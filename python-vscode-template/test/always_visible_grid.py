from ursina import *

app = Ursina(borderless=False, title='Step3 - No Lights')

# 关闭调试信息
window.fps_counter.enabled = False
window.entity_counter.enabled = False
window.exit_button.visible = False

# 地面（纹理 white_cube，但网格只靠 Grid）
floor = Entity(
    model='plane',
    scale=(20, 1, 20),
    color=color.rgb(200, 200, 200),
    texture='white_cube',
    position=(0, -0.5, 0),
    rotation_x=0,
    collider=None
)

# 网格（Grid 模型）
grid = Entity(
    model=Grid(10, 10),
    scale=10,
    position=(0, -0.4, 0),
    rotation_x=90,
    color=color.light_gray
)

# 摄像机
camera.position = (0, 8, -20)
camera.look_at((0, 0.5, 0))
camera.fov = 50

if __name__ == '__main__':
    app.run()
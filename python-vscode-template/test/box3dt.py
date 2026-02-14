from ursina import *

app = Ursina(borderless=False, title='Step3a - Only Grid (no floor)')

# 关闭调试信息
window.fps_counter.enabled = False
window.entity_counter.enabled = False
window.exit_button.visible = False

# 网格（Grid 模型）—— 完全与第3步相同
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
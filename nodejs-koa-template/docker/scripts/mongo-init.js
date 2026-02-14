db.createUser({
  user: "koa_user",
  pwd: "koa_password",
  roles: [
    { role: "readWrite", db: "koa_template_dev" },
    { role: "read", db: "admin" }
  ]
});

print("✅ MongoDB初始化完成 - Koa Template App");
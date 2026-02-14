import env

from pyecharts.charts import Line

line = Line()

line.add_xaxis(["中国", "美国", "英国"])

line.add_yaxis("GDP", [30, 20, 10])

output_file = env.OUTPUT_DIR + "/show-gdp.html"

line.render(output_file)

# line.render("output/show-gdp.html")

print(f"render finished, please see {output_file}\n")

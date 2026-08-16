# 实时天气数据接口参考

本轮天气功能使用 Open-Meteo 的公开接口，采用用户手动城市查询触发的直接请求，不设置后台轮询。

| 用途 | 端点与参数 | 前端实现要点 | 来源 |
| --- | --- | --- | --- |
| 城市搜索 | `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=5&language=zh&format=json` | 从结果中读取 `name`、`latitude`、`longitude`、`timezone`，允许用户选定同名城市。 | [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) |
| 实时天气与预报 | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_days=1&timezone=auto` | 用 `current` 展示实时温度、湿度、体感、天气代码与风速；用 `hourly` 呈现接下来数小时预报。 | [Weather Forecast API](https://open-meteo.com/en/docs) |

> 数据访问说明：该网页仅在用户搜索城市或点击刷新时请求，不会自动持续抓取。网络不可用时保留现有天气卡片并显示可读的失败提示。

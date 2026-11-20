# Барбершоп «Самурай» — макет сайта

Статический сайт: HTML + CSS + JS без сборки. Можно открыть на любом хостинге.

## Запуск локально
```
python -m http.server 5173
```
Затем открыть http://localhost:5173

## Страницы
- `index.html` — главная
- `services.html` — прайс (16 услуг, DIKIDI)
- `masters.html` — мастера
- `booking.html` — запись: услуги → мастер → свободные окна → контакты
- `gallery.html` — работы и интерьер
- `reviews.html` — отзывы
- `contacts.html` — контакты и карта

## Данные
Все тексты, цены, мастера, отзывы и фото лежат в `assets/js/data.js`.

Запись в макете демонстрационная. Занятость окон генерируется. Записи клиента хранятся в localStorage браузера, поэтому после записи окно становится занятым. Для боевой версии нужно подключить DIKIDI/CRM.

## Яндекс Метрика
В `assets/js/analytics.js` вписать номер счётчика в `YM_ID`. Счётчик и вебвизор подключатся сами.

Цели (`reachGoal`):
- `booking_start` — начало записи
- `booking_step_1..4` — шаги записи
- `booking_submit` — нажатие «Записаться»
- `booking_done` — запись создана
- `booking_cancel` — запись отменена
- `booking_ics` — запись добавлена в календарь
- `booking_cta_*`, `booking_from_*` — источники перехода в запись
- `call_click`, `whatsapp_click`, `telegram_click`, `instagram_click` — клики по контактам
- `route_yandex`, `route_2gis` — переход к маршруту
- `gallery_open`, `gallery_filter` — работа с галереей
- `review_leave` — переход к отзывам в 2GIS

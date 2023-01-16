Отчёт по лабораторной работе №5
========================
по курсу Основы программирования  
по теме Разработка сервисов

выполнила: Пронина Э.О. 3132 группа  
преподаватель: Жиданов К.А.

Санкт-Петербург, 2023 г. 

#### Задание и цель работы
------------------------
Разработать и реализовать алгоритм внешней сортировки. Данные хранятся на сервере в массиве, сервер представляет доступ к отдельным элементам. Клиент поочередно запрашивал отдельные ячейки сортирует массив.

#### Реализация
------------------------
Был разработан сайт сортировки с постами из телеграм-канала Devhumor с возможностью сортировать по идентификатору, времени, зазванию, размеру, ширине и высоте файла в поредке убывания и возрастания.

#### Выбор технологии
------------------------

*Среда разработки:* Visual Studio Code
*Инструменты:* JS, css, Handlebars  

#### Процесс реализации
------------------------

#### Пользовательский сценарий работы

Пользователь попадает на страницу приложения в браузере.
Ему на выбор предлагается выбрать поле сортировки по: идентификатору, времени поста, названию файла, размера файла картинки, ширине и высоте картинки. Так же предлагается порядок сортировки по возрастанию и убыванию.
При выборе поля и порядка сортировки пользователь нажимает "пересортировать" и запускается процесс сортировки. Кнопка перемешать - перемешивает рандомным образом.
Так же пользователь может ввести и отправить сообщение на консоль сервера.



#### Структура базы данных
![хореография](https://github.com/prelinory/course-work/blob/main/img/api.png)


#### Алгоритм

Алгоритм выбора параметров сортировки
![алгоритм](https://github.com/prelinory/lab5/blob/main/imggh/alg.jpg)

Алгоритм сортировки
![сортировка](https://github.com/prelinory/lab5/blob/main/imggh/algsort.jpg)

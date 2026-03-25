p='streamlit_app.py'
with open(p,'r',encoding='utf-8') as f:
    lines=f.readlines()
for i in range(540,640):
    print(i+1, repr(lines[i]))

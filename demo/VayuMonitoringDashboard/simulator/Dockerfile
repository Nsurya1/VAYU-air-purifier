FROM python:3.12-slim

WORKDIR /app

COPY simulator/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY simulator/ ./simulator/
COPY docs/specs/ ./docs/specs/

ENV PYTHONUNBUFFERED=1

CMD ["python", "simulator/run_simulator.py", "--broker", "mosquitto", "--port", "1883", "--interval", "5"]

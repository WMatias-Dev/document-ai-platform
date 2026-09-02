from fastapi import status


def test_evaluation_routes_require_authentication(client):
    """Garante que todas as rotas de avaliação exigem token Bearer JWT."""
    # 1. Listagem de runs
    res_runs = client.get("/evaluation/runs")
    assert res_runs.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Baseline
    res_baseline = client.get("/evaluation/baseline")
    assert res_baseline.status_code == status.HTTP_401_UNAUTHORIZED

    # 3. Disparo de run
    res_run = client.post("/evaluation/run", json={"name": "Test Run"})
    assert res_run.status_code == status.HTTP_401_UNAUTHORIZED


def test_evaluation_list_runs_authenticated(client, user_token_headers):
    """Garante que usuários autenticados conseguem consultar as execuções."""
    response = client.get("/evaluation/runs", headers=user_token_headers)
    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)
